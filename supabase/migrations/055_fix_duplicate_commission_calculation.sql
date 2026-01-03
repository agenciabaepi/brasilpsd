-- ============================================================================
-- Migration: 055 - Corrigir cálculo duplicado de comissões
-- Descrição: Garante que cada recurso gere apenas UMA comissão por mês,
--            independente de quantos downloads do mesmo recurso aconteçam
-- Data: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- 1. Atualizar função calculate_commission_for_download
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_commission_for_download(
  p_download_id UUID,
  p_resource_id UUID
)
RETURNS UUID -- Retorna o ID do creator_earning criado
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool_id UUID;
  v_pool RECORD;
  v_resource RECORD;
  v_creator_id UUID;
  v_month_year TEXT;
  v_commission_per_download DECIMAL(10, 4);
  v_commission_rate DECIMAL(5, 2);
  v_earning_id UUID;
  v_total_downloads INTEGER;
  v_already_has_earning BOOLEAN;
BEGIN
  -- Obter informações do recurso e criador
  SELECT 
    r.creator_id,
    r.id
  INTO v_resource
  FROM public.resources r
  WHERE r.id = p_resource_id
    AND r.status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurso não encontrado ou não aprovado';
  END IF;
  
  v_creator_id := v_resource.creator_id;
  
  -- Obter ou criar pool do mês atual
  v_pool_id := public.get_or_create_current_pool();
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- CRÍTICO: Verificar se já existe earning para este recurso neste mês
  -- Cada recurso só pode gerar UMA comissão por mês, independente de quantos downloads
  SELECT EXISTS(
    SELECT 1 
    FROM public.creator_earnings 
    WHERE resource_id = p_resource_id 
      AND month_year = v_month_year
  ) INTO v_already_has_earning;
  
  -- Se já existe earning para este recurso no mês, retornar o ID existente
  IF v_already_has_earning THEN
    SELECT id INTO v_earning_id
    FROM public.creator_earnings
    WHERE resource_id = p_resource_id 
      AND month_year = v_month_year
    LIMIT 1;
    
    -- Retornar o earning existente sem criar novo
    RETURN v_earning_id;
  END IF;
  
  -- Obter informações do pool
  SELECT 
    total_revenue,
    commission_percentage,
    total_downloads,
    remaining_amount,
    status
  INTO v_pool
  FROM public.revenue_pool
  WHERE id = v_pool_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool não encontrado';
  END IF;
  
  -- Se pool está fechado ou distribuído, não calcular comissão
  IF v_pool.status IN ('closed', 'distributed') THEN
    RAISE EXCEPTION 'Pool do mês atual está fechado ou distribuído';
  END IF;
  
  -- Sempre atualizar o pool antes de calcular comissão (garante dados atualizados)
  PERFORM public.update_revenue_pool_from_subscriptions();
  
  -- Buscar novamente o pool atualizado
  SELECT 
    total_revenue,
    commission_percentage,
    total_downloads,
    remaining_amount,
    status
  INTO v_pool
  FROM public.revenue_pool
  WHERE id = v_pool_id;
  
  -- Calcular valor disponível para distribuição
  DECLARE
    v_available_for_creators DECIMAL(12, 2);
    v_pool_amount DECIMAL(12, 2);
  BEGIN
    -- Valor total disponível para criadores = total_revenue * (commission_percentage / 100)
    v_available_for_creators := v_pool.total_revenue * (v_pool.commission_percentage / 100.0);
    v_pool_amount := v_available_for_creators;
    
    -- IMPORTANTE: No sistema Revenue Pool, o valor por download é recalculado a cada novo download
    -- Contamos quantos earnings já foram criados no mês (cada earning = 1 recurso único que gerou comissão)
    SELECT COUNT(*)
    INTO v_total_downloads
    FROM public.creator_earnings ce
    WHERE ce.month_year = v_month_year;
    
    -- Adicionar 1 para incluir o download atual que está sendo processado
    v_total_downloads := v_total_downloads + 1;
    
    -- Se não há downloads ainda, usar 1 para evitar divisão por zero
    IF v_total_downloads = 0 THEN
      v_total_downloads := 1;
    END IF;
    
    -- Calcular comissão por download = valor disponível / total de downloads (incluindo este)
    -- Isso garante que cada download recebe uma parte igual do pool
    v_commission_per_download := v_available_for_creators / v_total_downloads;
    
    -- Taxa de comissão (percentual)
    v_commission_rate := v_pool.commission_percentage;
    
    -- Criar registro de earning primeiro
    INSERT INTO public.creator_earnings (
      creator_id,
      resource_id,
      download_id,
      pool_id,
      month_year,
      amount,
      commission_rate,
      pool_amount,
      downloads_in_pool,
      commission_per_download,
      status
    )
    VALUES (
      v_creator_id,
      p_resource_id,
      p_download_id,
      v_pool_id,
      v_month_year,
      v_commission_per_download,
      v_commission_rate,
      v_pool_amount,
      v_total_downloads,
      v_commission_per_download,
      'pending'
    )
    RETURNING id INTO v_earning_id;
    
    -- IMPORTANTE: Recalcular comissões anteriores para manter proporção igual
    -- Quando um novo download é adicionado, o valor por download diminui
    -- Então precisamos atualizar todos os earnings anteriores do mês (exceto o que acabamos de criar)
    UPDATE public.creator_earnings
    SET 
      commission_per_download = v_commission_per_download,
      amount = v_commission_per_download,
      downloads_in_pool = v_total_downloads,
      pool_amount = v_pool_amount
    WHERE month_year = v_month_year
      AND id != v_earning_id;
    
    -- Atualizar pool: atualizar total_downloads e recalcular distributed_amount
    -- distributed_amount = soma de todos os earnings do mês
    DECLARE
      v_total_distributed DECIMAL(12, 2);
    BEGIN
      SELECT COALESCE(SUM(amount), 0)
      INTO v_total_distributed
      FROM public.creator_earnings
      WHERE month_year = v_month_year;
      
      UPDATE public.revenue_pool
      SET 
        total_downloads = v_total_downloads,
        distributed_amount = v_total_distributed,
        remaining_amount = (total_revenue * (commission_percentage / 100.0)) - v_total_distributed,
        updated_at = NOW()
      WHERE id = v_pool_id;
    END;
  END;
  
  RETURN v_earning_id;
END;
$$;

COMMENT ON FUNCTION public.calculate_commission_for_download(UUID, UUID) IS 
'Calcula e registra comissão para o criador baseado no Revenue Pool atual. Cada recurso gera apenas UMA comissão por mês, independente de quantos downloads. Retorna o ID do earning criado.';

-- ============================================================================
-- 2. Atualizar trigger para verificar antes de calcular
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_calculate_commission_on_download()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
  v_already_has_earning BOOLEAN;
  v_earning_id UUID;
BEGIN
  -- CRÍTICO: Verificar se já existe earning para este recurso neste mês
  -- Cada recurso só pode gerar UMA comissão por mês, independente de quantos downloads
  -- Isso evita que o mesmo recurso gere múltiplas comissões quando baixado várias vezes
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Verificar se já existe earning para este recurso no mês atual
  SELECT EXISTS(
    SELECT 1 
    FROM public.creator_earnings 
    WHERE resource_id = NEW.resource_id 
      AND month_year = v_month_year
  ) INTO v_already_has_earning;
  
  -- Se já existe earning para este recurso no mês, não calcular novamente
  IF v_already_has_earning THEN
    RETURN NEW;
  END IF;
  
  -- Se não existe earning, verificar se recurso está aprovado e calcular comissão
  IF EXISTS (
    SELECT 1 
    FROM public.resources 
    WHERE id = NEW.resource_id 
    AND status = 'approved'
  ) THEN
    BEGIN
      -- Calcular comissão (pode falhar se pool estiver fechado, mas não queremos bloquear o download)
      v_earning_id := public.calculate_commission_for_download(NEW.id, NEW.resource_id);
      
      -- Log de sucesso (opcional)
      -- RAISE NOTICE 'Comissão calculada: earning_id = %', v_earning_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Se falhar, apenas logar o erro mas não bloquear o download
        RAISE WARNING 'Erro ao calcular comissão para download %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_calculate_commission_on_download() IS 
'Trigger que calcula comissão automaticamente após um download ser registrado. Cada recurso gera apenas UMA comissão por mês, independente de quantos downloads.';

-- ============================================================================
-- 3. Remover earnings duplicados (se houver)
-- ============================================================================

-- Remover earnings duplicados, mantendo apenas o primeiro de cada recurso por mês
DELETE FROM public.creator_earnings ce1
WHERE EXISTS (
  SELECT 1 
  FROM public.creator_earnings ce2
  WHERE ce2.resource_id = ce1.resource_id
    AND ce2.month_year = ce1.month_year
    AND ce2.id < ce1.id  -- Manter apenas o primeiro (menor ID)
);

-- ============================================================================
-- 4. Recalcular comissões após remover duplicados
-- ============================================================================

-- Recalcular comissões de todos os meses ativos
DO $$
DECLARE
  pool_record RECORD;
BEGIN
  FOR pool_record IN 
    SELECT month_year 
    FROM public.revenue_pool 
    WHERE status = 'active' 
      AND total_revenue > 0
  LOOP
    -- Recalcular comissões do mês
    PERFORM public.recalculate_month_earnings(pool_record.month_year);
  END LOOP;
END;
$$;


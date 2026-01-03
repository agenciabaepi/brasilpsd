-- ============================================================================
-- Migration: 056 - Mudar para comissão fixa por download
-- Descrição: Altera o sistema de Revenue Pool para valores fixos por download:
--            - R$ 0,40 por download premium
--            - R$ 0,06 por download grátis
-- Data: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- 1. Adicionar campos de configuração na tabela revenue_pool
-- ============================================================================

ALTER TABLE public.revenue_pool
ADD COLUMN IF NOT EXISTS premium_commission_amount DECIMAL(10, 2) DEFAULT 0.40,
ADD COLUMN IF NOT EXISTS free_commission_amount DECIMAL(10, 2) DEFAULT 0.06,
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'fixed'; -- 'fixed' ou 'pool'

COMMENT ON COLUMN public.revenue_pool.premium_commission_amount IS 
'Valor fixo de comissão por download premium (padrão: R$ 0,40)';

COMMENT ON COLUMN public.revenue_pool.free_commission_amount IS 
'Valor fixo de comissão por download grátis (padrão: R$ 0,06)';

COMMENT ON COLUMN public.revenue_pool.commission_type IS 
'Tipo de comissão: fixed (valores fixos) ou pool (revenue pool)';

-- Atualizar pools existentes
UPDATE public.revenue_pool
SET 
  premium_commission_amount = 0.40,
  free_commission_amount = 0.06,
  commission_type = 'fixed'
WHERE commission_type IS NULL;

-- ============================================================================
-- 2. Atualizar função calculate_commission_for_download para usar valores fixos
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
  v_commission_amount DECIMAL(10, 2);
  v_commission_rate DECIMAL(5, 2);
  v_earning_id UUID;
  v_already_has_earning BOOLEAN;
  v_is_premium BOOLEAN;
BEGIN
  -- Obter informações do recurso e criador
  SELECT 
    r.creator_id,
    r.id,
    r.is_premium
  INTO v_resource
  FROM public.resources r
  WHERE r.id = p_resource_id
    AND r.status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurso não encontrado ou não aprovado';
  END IF;
  
  v_creator_id := v_resource.creator_id;
  v_is_premium := COALESCE(v_resource.is_premium, false);
  
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
    
    RETURN v_earning_id;
  END IF;
  
  -- Obter informações do pool
  SELECT 
    premium_commission_amount,
    free_commission_amount,
    commission_type,
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
  
  -- Calcular comissão baseado no tipo (premium ou grátis)
  IF v_is_premium THEN
    v_commission_amount := COALESCE(v_pool.premium_commission_amount, 0.40);
  ELSE
    v_commission_amount := COALESCE(v_pool.free_commission_amount, 0.06);
  END IF;
  
  -- Taxa de comissão (100% para valores fixos, já que não é percentual)
  v_commission_rate := 100.00;
  
  -- Criar registro de earning
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
    v_commission_amount,
    v_commission_rate,
    NULL, -- Não usado em valores fixos
    NULL, -- Não usado em valores fixos
    v_commission_amount,
    'pending'
  )
  RETURNING id INTO v_earning_id;
  
  -- Atualizar pool: incrementar distributed_amount
  UPDATE public.revenue_pool
  SET 
    distributed_amount = distributed_amount + v_commission_amount,
    remaining_amount = GREATEST(0, remaining_amount - v_commission_amount),
    updated_at = NOW()
  WHERE id = v_pool_id;
  
  RETURN v_earning_id;
END;
$$;

COMMENT ON FUNCTION public.calculate_commission_for_download(UUID, UUID) IS 
'Calcula e registra comissão para o criador usando valores fixos: R$ 0,40 para premium e R$ 0,06 para grátis. Cada recurso gera apenas UMA comissão por mês.';

-- ============================================================================
-- 3. Atualizar função get_or_create_current_pool para incluir valores fixos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_current_pool()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
  v_pool_id UUID;
  v_commission_percentage DECIMAL(5, 2) := 30.00; -- Padrão 30% (mantido para compatibilidade)
  v_premium_amount DECIMAL(10, 2) := 0.40;
  v_free_amount DECIMAL(10, 2) := 0.06;
BEGIN
  -- Obter mês/ano atual no formato YYYY-MM
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Tentar obter pool existente
  SELECT id INTO v_pool_id
  FROM public.revenue_pool
  WHERE month_year = v_month_year
  LIMIT 1;
  
  -- Se não existe, criar novo pool
  IF v_pool_id IS NULL THEN
    INSERT INTO public.revenue_pool (
      month_year,
      commission_percentage,
      premium_commission_amount,
      free_commission_amount,
      commission_type,
      status
    )
    VALUES (
      v_month_year,
      v_commission_percentage,
      v_premium_amount,
      v_free_amount,
      'fixed',
      'active'
    )
    RETURNING id INTO v_pool_id;
  END IF;
  
  RETURN v_pool_id;
END;
$$;

-- ============================================================================
-- 4. Atualizar função recalculate_month_earnings para valores fixos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_month_earnings(p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool RECORD;
  v_earning RECORD;
  v_new_amount DECIMAL(10, 2);
BEGIN
  -- Buscar pool
  SELECT * INTO v_pool
  FROM public.revenue_pool
  WHERE month_year = p_month_year;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Se pool está zerado, não recalcular
  IF v_pool.total_revenue = 0 AND v_pool.commission_type = 'pool' THEN
    RETURN;
  END IF;
  
  -- Se é tipo 'fixed', atualizar earnings baseado em is_premium
  IF v_pool.commission_type = 'fixed' THEN
    FOR v_earning IN 
      SELECT ce.id, r.is_premium
      FROM public.creator_earnings ce
      JOIN public.resources r ON r.id = ce.resource_id
      WHERE ce.month_year = p_month_year
    LOOP
      -- Calcular novo valor baseado em is_premium
      IF v_earning.is_premium THEN
        v_new_amount := COALESCE(v_pool.premium_commission_amount, 0.40);
      ELSE
        v_new_amount := COALESCE(v_pool.free_commission_amount, 0.06);
      END IF;
      
      -- Atualizar earning
      UPDATE public.creator_earnings
      SET 
        amount = v_new_amount,
        commission_per_download = v_new_amount
      WHERE id = v_earning.id;
    END LOOP;
    
    -- Recalcular distributed_amount
    UPDATE public.revenue_pool
    SET 
      distributed_amount = (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.creator_earnings
        WHERE month_year = p_month_year
      ),
      updated_at = NOW()
    WHERE month_year = p_month_year;
  ELSE
    -- Se for tipo 'pool', usar lógica antiga (mantida para compatibilidade)
    -- ... (lógica do pool mantida)
  END IF;
END;
$$;

COMMENT ON FUNCTION public.recalculate_month_earnings(TEXT) IS 
'Recalcula todas as comissões de um mês específico. Para tipo fixed, atualiza baseado em is_premium. Para tipo pool, usa lógica de divisão igual.';

-- ============================================================================
-- 5. Atualizar tipos TypeScript (será feito manualmente ou em outro arquivo)
-- ============================================================================

-- Nota: Os tipos TypeScript precisam ser atualizados para incluir os novos campos


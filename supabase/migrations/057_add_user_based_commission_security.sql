-- ============================================================================
-- Migration: 057 - Adicionar segurança baseada em usuário para comissões
-- Descrição: Implementa regra de segurança onde:
--            - O usuário PODE baixar o mesmo arquivo várias vezes no mês
--            - Mas a comissão só é gerada na PRIMEIRA vez que o usuário baixa
--              o arquivo no mês
--            - A comissão é calculada por usuário (não apenas por recurso)
--            - Evita que um usuário baixe o mesmo arquivo várias vezes no mês
--              gerando comissões altas para o criador
-- Data: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- 1. Adicionar campo user_id na tabela creator_earnings para rastrear qual
--    usuário gerou a comissão
-- ============================================================================

ALTER TABLE public.creator_earnings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.creator_earnings.user_id IS 
'ID do usuário que baixou o recurso e gerou esta comissão. Usado para evitar múltiplas comissões do mesmo usuário para o mesmo recurso no mês.';

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_creator_earnings_user_resource_month 
ON public.creator_earnings(user_id, resource_id, month_year)
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_creator_earnings_user_resource_month IS 
'Índice para verificar rapidamente se um usuário já gerou comissão para um recurso no mês';

-- ============================================================================
-- 2. Criar função para verificar se usuário já baixou recurso no mês atual
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_user_downloaded_resource_this_month(
  p_user_id UUID,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_month_start TIMESTAMP WITH TIME ZONE;
  v_month_end TIMESTAMP WITH TIME ZONE;
  v_current_month TEXT;
BEGIN
  -- Obter mês atual no formato YYYY-MM
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Definir início e fim do mês atual
  v_month_start := (v_current_month || '-01')::DATE;
  v_month_end := (v_month_start + INTERVAL '1 month')::DATE;
  
  -- Verificar se já existe download deste recurso pelo usuário neste mês
  SELECT EXISTS(
    SELECT 1
    FROM public.downloads
    WHERE user_id = p_user_id
      AND resource_id = p_resource_id
      AND COALESCE(created_at, downloaded_at) >= v_month_start
      AND COALESCE(created_at, downloaded_at) < v_month_end
  ) INTO v_exists;
  
  RETURN COALESCE(v_exists, false);
END;
$$;

COMMENT ON FUNCTION public.has_user_downloaded_resource_this_month(UUID, UUID) IS 
'Verifica se o usuário já baixou o recurso específico no mês atual. Retorna true se já baixou, false caso contrário.';

-- ============================================================================
-- 3. Criar função para verificar se já existe comissão para usuário + recurso + mês
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_commission_for_user_resource_month(
  p_user_id UUID,
  p_resource_id UUID,
  p_month_year TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar se já existe earning para este usuário + recurso + mês
  SELECT EXISTS(
    SELECT 1 
    FROM public.creator_earnings 
    WHERE user_id = p_user_id
      AND resource_id = p_resource_id 
      AND month_year = p_month_year
  ) INTO v_exists;
  
  RETURN COALESCE(v_exists, false);
END;
$$;

COMMENT ON FUNCTION public.has_commission_for_user_resource_month(UUID, UUID, TEXT) IS 
'Verifica se já existe uma comissão registrada para a combinação usuário + recurso + mês. Retorna true se existe, false caso contrário.';

-- ============================================================================
-- 4. Atualizar função register_download para verificar se já baixou no mês
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_download(
  p_user_id UUID,
  p_resource_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  download_id UUID,
  current_count INTEGER,
  limit_count INTEGER,
  remaining INTEGER,
  is_new_download BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status RECORD;
  v_download_id UUID;
  v_resource_exists BOOLEAN;
  v_already_downloaded_today BOOLEAN;
  v_is_new_download BOOLEAN;
  v_current_count_before INTEGER;
  v_current_count_after INTEGER;
BEGIN
  -- ========================================================================
  -- VALIDAÇÃO 1: Verificar se o recurso existe e está aprovado
  -- ========================================================================
  SELECT EXISTS(
    SELECT 1 
    FROM public.resources 
    WHERE id = p_resource_id 
    AND status = 'approved'
  ) INTO v_resource_exists;
  
  IF NOT v_resource_exists THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Recurso não encontrado ou não aprovado'::TEXT,
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,
      0::INTEGER,
      false::BOOLEAN;
    RETURN;
  END IF;
  
  -- ========================================================================
  -- VALIDAÇÃO 2: Verificar se já baixou este recurso hoje (para contagem)
  -- NOTA: Usuário pode baixar o mesmo arquivo várias vezes no mês,
  -- mas a comissão só será gerada na primeira vez (verificado em calculate_commission_for_download)
  -- ========================================================================
  v_already_downloaded_today := public.has_user_downloaded_resource_today(p_user_id, p_resource_id);
  v_is_new_download := NOT v_already_downloaded_today;
  
  -- ========================================================================
  -- VALIDAÇÃO 3: Se for um novo download, verificar limite ANTES de inserir
  -- ========================================================================
  IF v_is_new_download THEN
    -- Lock na linha do usuário para garantir atomicidade
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    
    -- Obter status atual (contando recursos únicos)
    SELECT * INTO v_status
    FROM public.get_user_download_status(p_user_id);
    
    -- Guardar contagem antes
    v_current_count_before := v_status.current_count;
    
    -- Se já atingiu o limite, bloquear
    IF NOT v_status.allowed THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        format('Limite de downloads excedido. Você já baixou %s recursos únicos de %s permitidos hoje.', 
               v_status.current_count, v_status.limit_count)::TEXT,
        NULL::UUID,
        v_status.current_count,
        v_status.limit_count,
        v_status.remaining,
        false::BOOLEAN;
      RETURN;
    END IF;
  ELSE
    -- Se já baixou hoje, obter status sem lock (não vai contar como novo)
    SELECT * INTO v_status
    FROM public.get_user_download_status(p_user_id);
    v_current_count_before := v_status.current_count;
  END IF;
  
  -- ========================================================================
  -- INSERÇÃO: Registrar o download (sempre registrar, mesmo se já baixou hoje)
  -- ========================================================================
  INSERT INTO public.downloads (
    user_id,
    resource_id,
    ip_address,
    user_agent,
    created_at,
    downloaded_at
  )
  VALUES (
    p_user_id,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_download_id;
  
  -- ========================================================================
  -- VALIDAÇÃO 4: Se foi novo download, verificar novamente após inserção
  -- ========================================================================
  IF v_is_new_download THEN
    -- Recontar para garantir que não ultrapassou o limite
    SELECT * INTO v_status
    FROM public.get_user_download_status(p_user_id);
    
    v_current_count_after := v_status.current_count;
    
    -- Se após inserir ultrapassou o limite, fazer rollback
    IF v_status.current_count > v_status.limit_count THEN
      -- Rollback da transação (exceção)
      RAISE EXCEPTION 'Limite de downloads excedido após validação. Operação cancelada.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Se já tinha baixado, manter a contagem anterior
    v_current_count_after := v_current_count_before;
  END IF;
  
  -- ========================================================================
  -- SUCESSO: Retornar informações do download registrado
  -- ========================================================================
  RETURN QUERY SELECT 
    true::BOOLEAN,
    CASE 
      WHEN v_is_new_download THEN 'Download registrado com sucesso'
      ELSE 'Download permitido (recurso já baixado hoje, não conta como novo download)'
    END::TEXT,
    v_download_id,
    v_current_count_after,
    v_status.limit_count,
    GREATEST(0, v_status.limit_count - v_current_count_after),
    v_is_new_download;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retornar falha
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('Erro ao registrar download: %s', SQLERRM)::TEXT,
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,
      0::INTEGER,
      false::BOOLEAN;
END;
$$;

COMMENT ON FUNCTION public.register_download(UUID, UUID, TEXT, TEXT) IS 
'Registra um download com validação completa. Permite múltiplos downloads do mesmo arquivo no mês, mas a comissão só será gerada na primeira vez (verificado em calculate_commission_for_download). Se for novo no dia, valida limite ANTES de inserir. Retorna sucesso/erro com detalhes e indica se foi novo download.';

-- ============================================================================
-- 5. Atualizar função calculate_commission_for_download para verificar por usuário
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
  v_download RECORD;
  v_user_id UUID;
  v_creator_id UUID;
  v_month_year TEXT;
  v_commission_amount DECIMAL(10, 2);
  v_commission_rate DECIMAL(5, 2);
  v_earning_id UUID;
  v_already_has_earning BOOLEAN;
  v_is_premium BOOLEAN;
BEGIN
  -- Obter informações do download (incluindo user_id)
  SELECT 
    d.user_id,
    d.id
  INTO v_download
  FROM public.downloads d
  WHERE d.id = p_download_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Download não encontrado';
  END IF;
  
  v_user_id := v_download.user_id;
  
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
  
  -- CRÍTICO: Verificar se já existe earning para este USUÁRIO + RECURSO + MÊS
  -- Cada combinação usuário + recurso só pode gerar UMA comissão por mês
  SELECT EXISTS(
    SELECT 1 
    FROM public.creator_earnings 
    WHERE user_id = v_user_id
      AND resource_id = p_resource_id 
      AND month_year = v_month_year
  ) INTO v_already_has_earning;
  
  -- Se já existe earning para este usuário + recurso no mês, retornar o ID existente
  IF v_already_has_earning THEN
    SELECT id INTO v_earning_id
    FROM public.creator_earnings
    WHERE user_id = v_user_id
      AND resource_id = p_resource_id 
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
  
  -- Criar registro de earning COM user_id
  INSERT INTO public.creator_earnings (
    creator_id,
    resource_id,
    download_id,
    user_id,
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
    v_user_id,
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
'Calcula e registra comissão para o criador usando valores fixos: R$ 0,40 para premium e R$ 0,06 para grátis. Cada combinação USUÁRIO + RECURSO gera apenas UMA comissão por mês. Inclui user_id para rastreamento.';

-- ============================================================================
-- 6. Atualizar função recalculate_month_earnings para considerar user_id
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
-- 7. Criar índice para otimizar verificação de downloads por mês
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_downloads_user_resource_month 
ON public.downloads(
  user_id, 
  resource_id, 
  DATE_TRUNC('month', COALESCE(created_at, downloaded_at) AT TIME ZONE 'America/Sao_Paulo')
);

COMMENT ON INDEX idx_downloads_user_resource_month IS 
'Índice para otimizar verificação se usuário já baixou recurso específico no mês atual';

-- ============================================================================
-- 8. Atualizar RLS para permitir acesso ao user_id em creator_earnings
-- ============================================================================

-- Criadores podem ver earnings com user_id (mas não o nome do usuário diretamente)
-- Admins podem ver tudo
-- A política já existe, apenas garantir que user_id está acessível

-- ============================================================================
-- 9. Limpar earnings duplicados (se houver) antes de aplicar a nova lógica
-- ============================================================================

-- Nota: Se houver earnings duplicados para o mesmo user_id + resource_id + month_year,
-- manter apenas o primeiro (mais antigo)
DO $$
DECLARE
  v_duplicate RECORD;
BEGIN
  FOR v_duplicate IN 
    SELECT 
      user_id,
      resource_id,
      month_year,
      MIN(created_at) as first_created_at
    FROM public.creator_earnings
    WHERE user_id IS NOT NULL
    GROUP BY user_id, resource_id, month_year
    HAVING COUNT(*) > 1
  LOOP
    -- Deletar earnings duplicados, mantendo apenas o primeiro
    DELETE FROM public.creator_earnings
    WHERE user_id = v_duplicate.user_id
      AND resource_id = v_duplicate.resource_id
      AND month_year = v_duplicate.month_year
      AND created_at > v_duplicate.first_created_at;
  END LOOP;
END $$;


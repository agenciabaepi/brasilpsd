-- ============================================================================
-- Migration: 054 - Corrigir referências a amount em transactions
-- Descrição: Garante que todas as funções usam amount_liquid corretamente
-- Data: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- 1. Criar função recalculate_month_earnings PRIMEIRO (se não existir)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_month_earnings(p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool RECORD;
  v_total_downloads INTEGER;
  v_available_for_creators DECIMAL(12, 2);
  v_commission_per_download DECIMAL(10, 4);
BEGIN
  -- Buscar pool
  SELECT * INTO v_pool
  FROM public.revenue_pool
  WHERE month_year = p_month_year;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Se pool está zerado, não recalcular
  IF v_pool.total_revenue = 0 THEN
    RETURN;
  END IF;
  
  -- Calcular valor disponível
  v_available_for_creators := v_pool.total_revenue * (v_pool.commission_percentage / 100.0);
  
  -- Contar downloads únicos do mês
  SELECT COUNT(*) INTO v_total_downloads
  FROM public.creator_earnings
  WHERE month_year = p_month_year;
  
  IF v_total_downloads = 0 THEN
    RETURN;
  END IF;
  
  -- Calcular novo valor por download
  v_commission_per_download := v_available_for_creators / v_total_downloads;
  
  -- Atualizar todos os earnings do mês
  UPDATE public.creator_earnings
  SET 
    amount = v_commission_per_download,
    commission_per_download = v_commission_per_download,
    pool_amount = v_available_for_creators,
    downloads_in_pool = v_total_downloads
  WHERE month_year = p_month_year;
  
  -- Atualizar pool
  UPDATE public.revenue_pool
  SET 
    total_downloads = v_total_downloads,
    distributed_amount = v_commission_per_download * v_total_downloads,
    remaining_amount = v_available_for_creators - (v_commission_per_download * v_total_downloads),
    updated_at = NOW()
  WHERE month_year = p_month_year;
END;
$$;

COMMENT ON FUNCTION public.recalculate_month_earnings(TEXT) IS 
'Recalcula todas as comissões de um mês específico baseado no pool atualizado';

-- ============================================================================
-- 2. Agora criar/atualizar função update_revenue_pool_from_subscriptions
-- ============================================================================

-- Primeiro, fazer DROP da função existente para poder mudar o tipo de retorno
DROP FUNCTION IF EXISTS public.update_revenue_pool_from_subscriptions();

-- Recriar função update_revenue_pool_from_subscriptions para garantir que está correta
CREATE OR REPLACE FUNCTION public.update_revenue_pool_from_subscriptions()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  total_revenue DECIMAL(12, 2),
  transactions_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
  v_pool_id UUID;
  v_total_revenue DECIMAL(12, 2);
  v_transactions_count INTEGER;
BEGIN
  -- Obter mês/ano atual
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Obter ou criar pool
  v_pool_id := public.get_or_create_current_pool();
  
  -- Calcular receita total do mês atual de assinaturas ativas
  -- IMPORTANTE: Usar amount_liquid (valor líquido após taxas)
  SELECT 
    COALESCE(SUM(t.amount_liquid), 0),
    COUNT(*)
  INTO v_total_revenue, v_transactions_count
  FROM public.transactions t
  WHERE t.status = 'paid'
    AND DATE_TRUNC('month', t.created_at AT TIME ZONE 'America/Sao_Paulo') = 
        DATE_TRUNC('month', CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo');
  
  -- Atualizar pool
  UPDATE public.revenue_pool
  SET 
    total_revenue = v_total_revenue,
    remaining_amount = (v_total_revenue * (commission_percentage / 100.0)) - distributed_amount,
    updated_at = NOW()
  WHERE id = v_pool_id;
  
  -- Recalcular todas as comissões do mês se houver receita
  IF v_total_revenue > 0 THEN
    -- Recalcular comissões existentes
    PERFORM public.recalculate_month_earnings(v_month_year);
  END IF;
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    format('Pool atualizado com sucesso. Receita: %s de %s transações', 
           v_total_revenue, v_transactions_count)::TEXT,
    v_total_revenue,
    v_transactions_count;
END;
$$;

COMMENT ON FUNCTION public.update_revenue_pool_from_subscriptions() IS 
'Atualiza o revenue pool do mês atual com a receita total de assinaturas pagas (usando amount_liquid) e recalcula comissões';


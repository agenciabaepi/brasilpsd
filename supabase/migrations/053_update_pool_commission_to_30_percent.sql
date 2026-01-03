-- ============================================================================
-- Migration: 053 - Atualizar percentual de comissão para 30%
-- Descrição: Atualiza pools existentes e o DEFAULT da tabela para 30%
-- Data: 2025-01-XX
-- ============================================================================

-- Atualizar DEFAULT da coluna para 30%
ALTER TABLE public.revenue_pool
ALTER COLUMN commission_percentage SET DEFAULT 30.00;

-- Atualizar pools existentes que estão com 50% para 30%
UPDATE public.revenue_pool
SET commission_percentage = 30.00
WHERE commission_percentage = 50.00;

-- Recalcular comissões dos pools ativos que foram atualizados
DO $$
DECLARE
  pool_record RECORD;
BEGIN
  FOR pool_record IN 
    SELECT month_year 
    FROM public.revenue_pool 
    WHERE status = 'active' 
      AND commission_percentage = 30.00
      AND total_revenue > 0
  LOOP
    -- Recalcular comissões do mês
    PERFORM public.recalculate_month_earnings(pool_record.month_year);
  END LOOP;
END;
$$;

COMMENT ON COLUMN public.revenue_pool.commission_percentage IS 
'Percentual do pool destinado aos criadores (padrão: 30%)';


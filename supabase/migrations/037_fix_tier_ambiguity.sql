-- ============================================================================
-- Migration: 037 - Corrigir ambiguidade da coluna "tier"
-- Descrição: Corrige erro "column reference 'tier' is ambiguous" na função
--            get_user_download_status usando qualificação explícita de tabelas
-- Data: 2024
-- ============================================================================

-- Corrigir função get_user_download_status
CREATE OR REPLACE FUNCTION public.get_user_download_status(p_user_id UUID)
RETURNS TABLE(
  current_count INTEGER,
  limit_count INTEGER,
  remaining INTEGER,
  allowed BOOLEAN,
  tier TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_current INTEGER;
  v_remaining INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Obter tier do usuário (da tabela profiles ou subscriptions)
  -- Usar qualificação explícita para evitar ambiguidade com variável v_tier
  SELECT COALESCE(
    (SELECT public.subscriptions.tier FROM public.subscriptions 
     WHERE public.subscriptions.user_id = p_user_id 
     AND public.subscriptions.status = 'active' 
     AND public.subscriptions.current_period_end >= CURRENT_DATE
     ORDER BY public.subscriptions.created_at DESC LIMIT 1),
    (SELECT public.profiles.subscription_tier FROM public.profiles WHERE public.profiles.id = p_user_id),
    'free'
  ) INTO v_tier;
  
  -- Obter limite baseado no tier
  v_limit := public.get_download_limit(v_tier);
  
  -- Contar downloads do dia atual
  v_current := public.count_user_downloads_today(p_user_id);
  
  -- Calcular restantes
  v_remaining := GREATEST(0, v_limit - v_current);
  
  -- Verificar se está permitido
  v_allowed := v_current < v_limit;
  
  RETURN QUERY SELECT v_current, v_limit, v_remaining, v_allowed, v_tier;
END;
$$;

COMMENT ON FUNCTION public.get_user_download_status(UUID) IS 
'Retorna status completo de downloads do usuário: contagem atual, limite, restantes, se permitido e tier. Corrigido para evitar ambiguidade de coluna.';


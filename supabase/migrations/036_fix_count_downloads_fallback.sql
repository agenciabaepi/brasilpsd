-- ============================================================================
-- Migration: 036 - Corrigir função count_user_downloads_today com fallback
-- Descrição: Adiciona fallback para usar downloaded_at se created_at não existir
-- Data: 2024
-- ============================================================================

-- Atualizar função para usar fallback
CREATE OR REPLACE FUNCTION public.count_user_downloads_today(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count INTEGER;
  v_today_start TIMESTAMP WITH TIME ZONE;
  v_today_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Definir início e fim do dia atual no timezone do Brasil (America/Sao_Paulo)
  -- Isso garante que o "dia" seja de 00:00:00 até 23:59:59 no horário de Brasília
  -- Convertemos a data atual para o timezone do Brasil e pegamos o início do dia
  v_today_start := (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  v_today_end := v_today_start + INTERVAL '1 day';
  
  -- Contar downloads do usuário no dia atual
  -- Usamos COALESCE para usar created_at se existir, senão downloaded_at (fallback)
  SELECT COUNT(*)
  INTO v_count
  FROM public.downloads
  WHERE user_id = p_user_id
    AND COALESCE(created_at, downloaded_at) >= v_today_start
    AND COALESCE(created_at, downloaded_at) < v_today_end;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.count_user_downloads_today(UUID) IS 
'Conta quantos downloads o usuário fez hoje (timezone America/Sao_Paulo). Usa created_at se disponível, senão usa downloaded_at como fallback.';


-- ============================================================================
-- Migration: 033 - Sistema de Controle de Downloads Seguro
-- Descrição: Estrutura do banco de dados para controle de downloads por plano
-- Data: 2024
-- ============================================================================

-- ============================================================================
-- 1. ATUALIZAR TABELA DOWNLOADS
-- ============================================================================

-- Adicionar campos de auditoria (se não existirem)
ALTER TABLE public.downloads
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Adicionar coluna created_at para consistência (usando downloaded_at como fallback)
ALTER TABLE public.downloads
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;

-- Atualizar created_at com valor de downloaded_at para registros existentes
UPDATE public.downloads
SET created_at = downloaded_at
WHERE created_at IS NULL;

-- Definir default para created_at
ALTER TABLE public.downloads
ALTER COLUMN created_at SET DEFAULT NOW();

-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice composto para contagem rápida de downloads por usuário e data
-- Este índice é crítico para a função de contagem diária
-- O DESC permite ordenação eficiente para consultas de "últimos downloads"
CREATE INDEX IF NOT EXISTS idx_downloads_user_created_at 
ON public.downloads(user_id, created_at DESC);

-- Índice em resource_id já existe (idx_downloads_resource), mas vamos garantir
CREATE INDEX IF NOT EXISTS idx_downloads_resource_id 
ON public.downloads(resource_id);

-- ============================================================================
-- 3. FUNÇÃO: Obter limite de downloads por plano
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_download_limit(tier TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN tier = 'free' OR tier IS NULL THEN 1
    WHEN tier = 'lite' THEN 3
    WHEN tier = 'pro' THEN 10
    WHEN tier = 'plus' THEN 20
    ELSE 1 -- Default para free
  END;
END;
$$;

COMMENT ON FUNCTION public.get_download_limit(TEXT) IS 
'Retorna o limite de downloads por dia baseado no tier do plano';

-- ============================================================================
-- 4. FUNÇÃO: Contar downloads do usuário no dia atual (timezone Brasil)
-- ============================================================================

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
  -- Usamos COALESCE para usar created_at se existir, senão downloaded_at
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
'Conta quantos downloads o usuário fez hoje (timezone America/Sao_Paulo)';

-- ============================================================================
-- 5. FUNÇÃO: Verificar status de downloads do usuário
-- ============================================================================

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
'Retorna status completo de downloads do usuário: contagem atual, limite, restantes, se permitido e tier';

-- ============================================================================
-- 6. CONSTRAINTS E VALIDAÇÕES
-- ============================================================================

-- Garantir que user_id e resource_id não sejam nulos (já existe, mas vamos garantir)
ALTER TABLE public.downloads
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN resource_id SET NOT NULL;

-- Adicionar constraint para evitar downloads duplicados no mesmo dia
-- (opcional - pode ser removido se quiser permitir múltiplos downloads do mesmo recurso)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_downloads_user_resource_date_unique
-- ON public.downloads(user_id, resource_id, DATE(created_at AT TIME ZONE 'America/Sao_Paulo'));

-- ============================================================================
-- 7. TRIGGER: Garantir que created_at seja sempre preenchido
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_download_created_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se created_at não estiver definido, usar downloaded_at ou NOW()
  IF NEW.created_at IS NULL THEN
    NEW.created_at := COALESCE(NEW.downloaded_at, NOW());
  END IF;
  
  -- Se downloaded_at não estiver definido, usar created_at ou NOW()
  IF NEW.downloaded_at IS NULL THEN
    NEW.downloaded_at := COALESCE(NEW.created_at, NOW());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger antes de inserir ou atualizar
DROP TRIGGER IF EXISTS trigger_set_download_created_at ON public.downloads;
CREATE TRIGGER trigger_set_download_created_at
  BEFORE INSERT OR UPDATE ON public.downloads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_download_created_at();

-- ============================================================================
-- 8. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON COLUMN public.downloads.ip_address IS 
'Endereço IP do usuário no momento do download (para auditoria e segurança)';

COMMENT ON COLUMN public.downloads.user_agent IS 
'User agent do navegador no momento do download (para auditoria)';

COMMENT ON COLUMN public.downloads.created_at IS 
'Timestamp do download (usado para contagem diária)';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================


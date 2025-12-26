-- ============================================================================
-- Script de Verificação: Funções do Sistema de Downloads
-- Execute este script no Supabase SQL Editor para verificar se tudo está OK
-- ============================================================================

-- Verificar se todas as funções necessárias existem
SELECT 
  proname as "Função",
  CASE 
    WHEN proname IS NOT NULL THEN '✅ Existe'
    ELSE '❌ Não existe'
  END as "Status"
FROM pg_proc 
WHERE proname IN (
  'get_download_limit',
  'count_user_downloads_today',
  'get_user_download_status',
  'check_download_limit',
  'register_download',
  'can_user_download_resource'
)
ORDER BY proname;

-- Verificar se a tabela downloads tem as colunas necessárias
SELECT 
  column_name as "Coluna",
  data_type as "Tipo",
  CASE 
    WHEN column_name IS NOT NULL THEN '✅ Existe'
    ELSE '❌ Não existe'
  END as "Status"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'downloads'
  AND column_name IN ('ip_address', 'user_agent', 'created_at')
ORDER BY column_name;

-- Verificar se os índices existem
SELECT 
  indexname as "Índice",
  CASE 
    WHEN indexname IS NOT NULL THEN '✅ Existe'
    ELSE '❌ Não existe'
  END as "Status"
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'downloads'
  AND indexname IN ('idx_downloads_user_created_at', 'idx_downloads_resource_id')
ORDER BY indexname;

-- Testar função get_download_limit
SELECT 
  'get_download_limit' as "Teste",
  public.get_download_limit('free') as "Free (deve ser 1)",
  public.get_download_limit('lite') as "Lite (deve ser 3)",
  public.get_download_limit('pro') as "Pro (deve ser 10)",
  public.get_download_limit('plus') as "Plus (deve ser 20)";

-- Verificar permissões
SELECT 
  p.proname as "Função",
  r.rolname as "Role",
  CASE 
    WHEN has_function_privilege(r.rolname, p.oid, 'EXECUTE') THEN '✅ Tem permissão'
    ELSE '❌ Sem permissão'
  END as "Permissão"
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN (
  'get_download_limit',
  'count_user_downloads_today',
  'get_user_download_status',
  'check_download_limit',
  'register_download'
)
AND r.rolname = 'authenticated'
ORDER BY p.proname;


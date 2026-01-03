-- ============================================================================
-- SCRIPT DE TESTE: Sistema de Downloads Diários
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PASSO 1: Obter ID de um usuário para teste
-- ============================================================================
-- Se você souber o email do usuário, use esta query:
SELECT 
  id,
  email,
  full_name,
  subscription_tier
FROM public.profiles
WHERE email = 'seu-email@exemplo.com'  -- ⚠️ SUBSTITUA pelo email real
LIMIT 1;

-- OU, se quiser ver todos os usuários:
-- SELECT id, email, full_name, subscription_tier FROM public.profiles LIMIT 10;

-- ============================================================================
-- PASSO 2: Verificar se as funções SQL existem
-- ============================================================================
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname IN (
  'has_user_downloaded_resource_today',
  'count_unique_resources_downloaded_today',
  'count_user_downloads_today',
  'get_user_download_status',
  'register_download'
)
ORDER BY proname;

-- ============================================================================
-- PASSO 3: Testar contagem de downloads únicos
-- ============================================================================
-- ⚠️ SUBSTITUA '00000000-0000-0000-0000-000000000000' pelo ID real obtido no PASSO 1
SELECT 
  public.count_unique_resources_downloaded_today('00000000-0000-0000-0000-000000000000'::UUID) as recursos_unicos_hoje;

-- ============================================================================
-- PASSO 4: Testar status completo de downloads
-- ============================================================================
-- ⚠️ SUBSTITUA '00000000-0000-0000-0000-000000000000' pelo ID real obtido no PASSO 1
SELECT * FROM public.get_user_download_status('00000000-0000-0000-0000-000000000000'::UUID);

-- ============================================================================
-- PASSO 5: Verificar timezone e data atual
-- ============================================================================
SELECT 
  CURRENT_DATE as data_atual_utc,
  (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' as inicio_dia_brasil,
  (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day' as fim_dia_brasil,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brasil;

-- ============================================================================
-- PASSO 6: Ver downloads de hoje de um usuário específico
-- ============================================================================
-- ⚠️ SUBSTITUA '00000000-0000-0000-0000-000000000000' pelo ID real obtido no PASSO 1
SELECT 
  d.id,
  d.resource_id,
  r.title as resource_title,
  d.created_at,
  d.downloaded_at,
  DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') as dia_brasil,
  COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo' as timestamp_brasil
FROM public.downloads d
LEFT JOIN public.resources r ON r.id = d.resource_id
WHERE d.user_id = '00000000-0000-0000-0000-000000000000'::UUID
  AND DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY d.created_at DESC;

-- ============================================================================
-- PASSO 7: Verificar contagem manual (para comparar com a função)
-- ============================================================================
-- ⚠️ SUBSTITUA '00000000-0000-0000-0000-000000000000' pelo ID real obtido no PASSO 1
SELECT 
  COUNT(DISTINCT d.resource_id) as recursos_unicos_hoje,
  COUNT(*) as total_downloads_hoje,
  array_agg(DISTINCT d.resource_id) as lista_recursos_unicos
FROM public.downloads d
WHERE d.user_id = '00000000-0000-0000-0000-000000000000'::UUID
  AND DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;

-- ============================================================================
-- PASSO 8: Ver todos os downloads do usuário (últimos 10)
-- ============================================================================
-- ⚠️ SUBSTITUA '00000000-0000-0000-0000-000000000000' pelo ID real obtido no PASSO 1
SELECT 
  d.id,
  d.resource_id,
  r.title as resource_title,
  DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') as dia_brasil,
  COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo' as timestamp_brasil
FROM public.downloads d
LEFT JOIN public.resources r ON r.id = d.resource_id
WHERE d.user_id = '00000000-0000-0000-0000-000000000000'::UUID
ORDER BY d.created_at DESC
LIMIT 10;


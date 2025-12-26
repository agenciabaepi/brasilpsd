-- ============================================================================
-- Script de Teste: Função check_download_limit
-- Execute este script no Supabase SQL Editor para testar a função
-- ============================================================================

-- IMPORTANTE: Substitua 'SEU-USER-ID-AQUI' pelo ID real de um usuário do sistema
-- Você pode obter um ID de usuário com:
-- SELECT id, email FROM auth.users LIMIT 1;

-- Teste 1: Verificar se a função retorna dados
SELECT * FROM public.check_download_limit('SEU-USER-ID-AQUI'::UUID);

-- Teste 2: Verificar função get_user_download_status (usada internamente)
SELECT * FROM public.get_user_download_status('SEU-USER-ID-AQUI'::UUID);

-- Teste 3: Verificar função count_user_downloads_today
SELECT public.count_user_downloads_today('SEU-USER-ID-AQUI'::UUID) as downloads_hoje;

-- Teste 4: Verificar se a tabela downloads tem a coluna created_at
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'downloads'
  AND column_name IN ('created_at', 'ip_address', 'user_agent')
ORDER BY column_name;

-- Teste 5: Verificar se há downloads para o usuário hoje
-- (Substitua o user_id)
SELECT 
  COUNT(*) as total_downloads_hoje,
  MAX(created_at) as ultimo_download
FROM public.downloads
WHERE user_id = 'SEU-USER-ID-AQUI'::UUID
  AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;

-- Teste 6: Verificar tier do usuário
SELECT 
  p.id,
  p.email,
  p.subscription_tier,
  s.tier as subscription_tier_ativo,
  s.status as subscription_status
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status = 'active'
WHERE p.id = 'SEU-USER-ID-AQUI'::UUID;


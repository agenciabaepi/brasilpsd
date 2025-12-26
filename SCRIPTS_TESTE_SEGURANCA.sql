-- ============================================================================
-- Scripts de Teste de Segurança - Sistema de Downloads
-- Execute estes scripts no Supabase SQL Editor para validar o sistema
-- ============================================================================

-- ⚠️ IMPORTANTE: Antes de executar os testes, você DEVE:
-- 1. Executar a seção "PREPARAÇÃO" abaixo para obter IDs reais
-- 2. Substituir 'USER-ID-AQUI' e 'RESOURCE-ID-AQUI' pelos IDs obtidos
-- 3. Os placeholders 'USER-ID-AQUI' NÃO são UUIDs válidos e causarão erro!

-- ============================================================================
-- PREPARAÇÃO: Obter IDs para teste
-- ============================================================================

-- 1. Listar usuários disponíveis para teste
-- COPIE o ID de um usuário da lista abaixo e use nos testes
SELECT 
  id,
  email,
  subscription_tier,
  is_admin,
  is_creator
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- 2. Listar recursos disponíveis para teste
-- COPIE o ID de um recurso da lista abaixo e use nos testes
SELECT 
  id,
  title,
  status,
  creator_id
FROM public.resources
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- CONFIGURAÇÃO: Substitua os valores abaixo pelos IDs reais
-- ============================================================================

-- Exemplo de formato de UUID válido: '3f83bd21-d8ce-483a-a03b-bac87c26337c'
-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real de um usuário (obtido acima)
-- ⚠️ SUBSTITUA 'RESOURCE-ID-AQUI' pelo ID real de um recurso (obtido acima)

-- Para facilitar, você pode executar este SELECT para obter um usuário automaticamente:
-- (Descomente e execute para obter o primeiro usuário disponível)
/*
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id 
  FROM public.profiles 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RAISE NOTICE 'User ID para testes: %', v_user_id;
END $$;
*/

-- ============================================================================
-- TESTE 1: Verificar função check_download_limit
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
-- Exemplo: SELECT * FROM public.check_download_limit('3f83bd21-d8ce-483a-a03b-bac87c26337c'::UUID);
SELECT * FROM public.check_download_limit('USER-ID-AQUI'::UUID);

-- Resultado esperado:
-- - allowed: true/false
-- - current_count: número de downloads hoje
-- - limit_count: limite do plano
-- - remaining: downloads restantes

-- ============================================================================
-- TESTE 2: Verificar função get_user_download_status
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
SELECT * FROM public.get_user_download_status('USER-ID-AQUI'::UUID);

-- Resultado esperado:
-- - current_count, limit_count, remaining, allowed, tier

-- ============================================================================
-- TESTE 3: Verificar contagem de downloads do dia
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
SELECT 
  public.count_user_downloads_today('USER-ID-AQUI'::UUID) as downloads_hoje,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as horario_brasil,
  CURRENT_DATE as data_atual;

-- ============================================================================
-- TESTE 4: Verificar limite por plano
-- ============================================================================

SELECT 
  'free' as plano,
  public.get_download_limit('free') as limite
UNION ALL
SELECT 'lite', public.get_download_limit('lite')
UNION ALL
SELECT 'pro', public.get_download_limit('pro')
UNION ALL
SELECT 'plus', public.get_download_limit('plus');

-- Resultado esperado:
-- free: 1, lite: 3, pro: 10, plus: 20

-- ============================================================================
-- TESTE 5: Verificar downloads do usuário hoje (detalhado)
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
SELECT 
  d.id,
  d.created_at,
  d.created_at AT TIME ZONE 'America/Sao_Paulo' as created_at_brasil,
  DATE(d.created_at AT TIME ZONE 'America/Sao_Paulo') as data_brasil,
  r.title as resource_title
FROM public.downloads d
LEFT JOIN public.resources r ON r.id = d.resource_id
WHERE d.user_id = 'USER-ID-AQUI'::UUID
  AND DATE(d.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY d.created_at DESC;

-- ============================================================================
-- TESTE 6: Verificar se trigger bloqueia inserção direta
-- ============================================================================

-- ATENÇÃO: Este teste vai falhar se o limite já foi atingido
-- ⚠️ SUBSTITUA pelos IDs reais obtidos na seção PREPARAÇÃO
-- ⚠️ DESCOMENTE as linhas abaixo para executar
/*
INSERT INTO public.downloads (user_id, resource_id)
VALUES (
  'USER-ID-AQUI'::UUID,  -- Substitua pelo ID real do usuário
  'RESOURCE-ID-AQUI'::UUID  -- Substitua pelo ID real do recurso
);
*/

-- Resultado esperado:
-- - Se limite não atingido: inserção permitida
-- - Se limite atingido: erro "Limite de downloads excedido"

-- ============================================================================
-- TESTE 7: Verificar integridade - downloads sem recurso
-- ============================================================================

-- Verificar se há downloads "órfãos" (recurso deletado)
SELECT 
  d.id,
  d.user_id,
  d.resource_id,
  d.created_at
FROM public.downloads d
LEFT JOIN public.resources r ON r.id = d.resource_id
WHERE r.id IS NULL;

-- Resultado esperado: 0 linhas (ou apenas recursos deletados recentemente)

-- ============================================================================
-- TESTE 8: Verificar performance dos índices
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
-- Verificar se índices estão sendo usados
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM public.downloads
WHERE user_id = 'USER-ID-AQUI'::UUID
  AND created_at >= (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';

-- Resultado esperado:
-- - Deve usar índice "idx_downloads_user_created_at"
-- - Tempo de execução < 100ms

-- ============================================================================
-- TESTE 9: Verificar auditoria (IP e User Agent)
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
SELECT 
  id,
  user_id,
  ip_address,
  user_agent,
  created_at
FROM public.downloads
WHERE user_id = 'USER-ID-AQUI'::UUID
ORDER BY created_at DESC
LIMIT 10;

-- Resultado esperado:
-- - Todos devem ter ip_address e user_agent preenchidos
-- - Valores não devem ser NULL

-- ============================================================================
-- TESTE 10: Verificar timezone - início e fim do dia
-- ============================================================================

SELECT 
  NOW() as agora_utc,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brasil,
  CURRENT_DATE as data_atual,
  (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' as inicio_dia_brasil,
  ((CURRENT_DATE + INTERVAL '1 day')::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' as fim_dia_brasil;

-- ============================================================================
-- TESTE 11: Simular múltiplos downloads simultâneos (race condition)
-- ============================================================================

-- Este teste deve ser feito via API, não SQL
-- Use o script JavaScript no documento de testes

-- ============================================================================
-- TESTE 12: Verificar plano expirado
-- ============================================================================

-- ⚠️ SUBSTITUA 'USER-ID-AQUI' pelo ID real obtido na seção PREPARAÇÃO
-- Verificar assinaturas expiradas
SELECT 
  s.id,
  s.user_id,
  s.tier,
  s.status,
  s.current_period_end,
  CASE 
    WHEN s.current_period_end < CURRENT_DATE THEN 'EXPIRADA'
    ELSE 'ATIVA'
  END as status_real
FROM public.subscriptions s
WHERE s.user_id = 'USER-ID-AQUI'::UUID
ORDER BY s.created_at DESC;

-- Verificar qual tier o sistema está usando
SELECT * FROM public.get_user_download_status('USER-ID-AQUI'::UUID);

-- Resultado esperado:
-- - Se assinatura expirada, deve usar subscription_tier do profile ou 'free'
-- - Limite deve ser baseado no tier ativo

-- ============================================================================
-- FIM DOS SCRIPTS DE TESTE
-- ============================================================================


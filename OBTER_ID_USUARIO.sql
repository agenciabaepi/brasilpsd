-- ============================================================================
-- Script Auxiliar: Obter IDs para Testes
-- Execute este script PRIMEIRO para obter os IDs necessários
-- ============================================================================

-- ============================================================================
-- 1. OBTER ID DE UM USUÁRIO PARA TESTES
-- ============================================================================

-- Opção A: Obter o primeiro usuário disponível
SELECT 
  id as user_id_para_teste,
  email,
  subscription_tier,
  is_admin,
  is_creator,
  'Use este ID nos testes substituindo USER-ID-AQUI' as instrucao
FROM public.profiles
ORDER BY created_at DESC
LIMIT 1;

-- Opção B: Listar todos os usuários disponíveis
SELECT 
  id,
  email,
  subscription_tier,
  is_admin,
  is_creator
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. OBTER ID DE UM RECURSO PARA TESTES
-- ============================================================================

-- Opção A: Obter o primeiro recurso aprovado
SELECT 
  id as resource_id_para_teste,
  title,
  status,
  creator_id,
  'Use este ID nos testes substituindo RESOURCE-ID-AQUI' as instrucao
FROM public.resources
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 1;

-- Opção B: Listar recursos disponíveis
SELECT 
  id,
  title,
  status,
  creator_id
FROM public.resources
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 3. EXEMPLO DE USO: Teste rápido com ID obtido
-- ============================================================================

-- Após obter um user_id acima, substitua 'SEU-USER-ID-AQUI' e execute:
/*
SELECT * FROM public.get_user_download_status('SEU-USER-ID-AQUI'::UUID);
*/

-- ============================================================================
-- DICA: Copie e cole o ID diretamente
-- ============================================================================
-- 1. Execute as queries acima
-- 2. Clique no ID na coluna "id" ou "user_id_para_teste" 
-- 3. Copie o valor (Ctrl+C / Cmd+C)
-- 4. Cole no lugar de 'USER-ID-AQUI' nos scripts de teste
-- 5. Formato esperado: '3f83bd21-d8ce-483a-a03b-bac87c26337c' (com aspas simples)


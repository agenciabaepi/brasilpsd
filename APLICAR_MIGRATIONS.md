# Aplicar Migrations do Sistema de Downloads

## ⚠️ IMPORTANTE: Aplicar na ordem correta!

As migrations devem ser aplicadas na ordem abaixo no Supabase SQL Editor.

## Ordem de Aplicação

### 1. Migration 033 - Estrutura do Banco
**Arquivo:** `supabase/migrations/033_create_download_security_system.sql`

**O que faz:**
- Adiciona campos `ip_address` e `user_agent` na tabela `downloads`
- Adiciona coluna `created_at`
- Cria índices para performance
- Cria funções: `get_download_limit()`, `count_user_downloads_today()`, `get_user_download_status()`

**Como aplicar:**
1. Abra o Supabase Dashboard
2. Vá em SQL Editor
3. Copie TODO o conteúdo do arquivo `033_create_download_security_system.sql`
4. Cole e execute

### 2. Migration 034 - Funções de Validação
**Arquivo:** `supabase/migrations/034_create_download_validation_functions.sql`

**O que faz:**
- Cria função `check_download_limit()`
- Cria função `register_download()` (versão inicial)
- Cria função `can_user_download_resource()`
- Cria trigger de validação
- Atualiza políticas RLS

**Como aplicar:**
1. No SQL Editor do Supabase
2. Copie TODO o conteúdo do arquivo `034_create_download_validation_functions.sql`
3. Cole e execute

### 3. Migration 035 - Correção da Função
**Arquivo:** `supabase/migrations/035_fix_register_download_validation.sql`

**O que faz:**
- Corrige a função `register_download()` para remover validação de status
- Permite que criadores baixem seus próprios recursos

**Como aplicar:**
1. No SQL Editor do Supabase
2. Copie TODO o conteúdo do arquivo `035_fix_register_download_validation.sql`
3. Cole e execute

## Verificação

Após aplicar todas as migrations, verifique se as funções existem:

```sql
-- Verificar se as funções foram criadas
SELECT proname, proargnames 
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
```

Você deve ver 6 funções listadas.

## Teste Rápido

Teste a função principal:

```sql
-- Substitua pelos IDs reais
SELECT * FROM public.register_download(
  'seu-user-id-aqui'::UUID,
  'seu-resource-id-aqui'::UUID,
  '127.0.0.1',
  'test-agent'
);
```

Se retornar uma linha com `success = true`, está funcionando!

## Problemas Comuns

### Erro: "function does not exist"
- **Causa:** Migration não foi aplicada
- **Solução:** Aplicar a migration correspondente

### Erro: "permission denied"
- **Causa:** Permissões não foram concedidas
- **Solução:** Executar:
  ```sql
  GRANT EXECUTE ON FUNCTION public.register_download(UUID, UUID, TEXT, TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.check_download_limit(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.get_user_download_status(UUID) TO authenticated;
  ```

### Erro: "relation does not exist"
- **Causa:** Tabela `downloads` não tem a coluna `created_at`
- **Solução:** Aplicar migration 033 primeiro

## Status

- [ ] Migration 033 aplicada
- [ ] Migration 034 aplicada  
- [ ] Migration 035 aplicada
- [ ] Funções verificadas
- [ ] Teste realizado com sucesso


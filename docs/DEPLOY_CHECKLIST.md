# 🚀 Checklist de Deploy - Sistema de Downloads

## 📋 Pré-Deploy

### ✅ Migrations do Banco de Dados

- [ ] **Migration 033**: `create_download_security_system.sql`
  - Adiciona colunas `ip_address`, `user_agent`, `created_at` à tabela `downloads`
  - Cria índices de performance
  - Cria funções: `get_download_limit`, `count_user_downloads_today`, `get_user_download_status`
  - Cria trigger `trigger_set_download_created_at`

- [ ] **Migration 034**: `create_download_validation_functions.sql`
  - Cria funções: `check_download_limit`, `register_download`, `can_user_download_resource`
  - Cria trigger `validate_download_before_insert`
  - Atualiza políticas RLS

- [ ] **Migration 035**: `fix_register_download_validation.sql`
  - Remove validação redundante de status do recurso

- [ ] **Migration 036**: `fix_count_downloads_fallback.sql`
  - Adiciona fallback para `created_at` usando `COALESCE`

- [ ] **Migration 037**: `fix_tier_ambiguity.sql`
  - Corrige ambiguidade na coluna `tier`

**Ordem de Aplicação**: 033 → 034 → 035 → 036 → 037

**Como Aplicar**:
1. Acesse Supabase Dashboard → SQL Editor
2. Execute cada migration na ordem
3. Verifique se não há erros
4. Confirme que as funções foram criadas: `SELECT * FROM public.get_user_download_status('user-id'::UUID);`

---

### ✅ Variáveis de Ambiente

Verificar se todas as variáveis necessárias estão configuradas:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (para operações administrativas)
- [ ] Variáveis AWS S3 (para geração de URLs assinadas)
- [ ] `NODE_ENV` (deve ser `production` em produção)

---

### ✅ Verificações de Segurança

- [ ] **RLS Policies**: Verificar se políticas RLS estão ativas
  ```sql
  SELECT tablename, policyname, permissive, roles, cmd, qual 
  FROM pg_policies 
  WHERE tablename = 'downloads';
  ```

- [ ] **Permissões de Funções**: Verificar se funções têm permissões corretas
  ```sql
  SELECT routine_name, routine_type, security_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name LIKE '%download%';
  ```

- [ ] **Índices**: Verificar se índices foram criados
  ```sql
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE tablename = 'downloads';
  ```

---

## 🔧 Deploy

### ✅ Build e Testes

- [ ] Executar testes locais
- [ ] Verificar se não há erros de TypeScript
- [ ] Verificar se não há erros de lint
- [ ] Build de produção bem-sucedido: `npm run build`

### ✅ Deploy do Código

- [ ] Deploy do frontend/backend
- [ ] Verificar se o deploy foi bem-sucedido
- [ ] Verificar logs de inicialização

---

## 🧪 Pós-Deploy

### ✅ Testes Funcionais

- [ ] **Teste 1**: Usuário Free faz 1 download (deve funcionar)
- [ ] **Teste 2**: Usuário Free tenta fazer 2º download (deve bloquear)
- [ ] **Teste 3**: Usuário Pro faz 10 downloads (deve funcionar)
- [ ] **Teste 4**: Usuário Pro tenta fazer 11º download (deve bloquear)
- [ ] **Teste 5**: Verificar contador no perfil do usuário
- [ ] **Teste 6**: Verificar botão de download mostra restantes
- [ ] **Teste 7**: Verificar reset à meia-noite (aguardar ou simular)

### ✅ Testes de Segurança

- [ ] **Teste 1**: Tentar download sem autenticação (deve retornar 401)
- [ ] **Teste 2**: Tentar bypass via requisição direta (deve validar no servidor)
- [ ] **Teste 3**: Múltiplas requisições simultâneas (deve processar apenas 1)
- [ ] **Teste 4**: Rate limiting (20 req/min deve bloquear após limite)

### ✅ Verificações de Performance

- [ ] Tempo de resposta da API `/api/download` < 500ms
- [ ] Tempo de resposta da API `/api/downloads/status` < 200ms
- [ ] Cache funcionando (verificar header `X-Cache-Status`)
- [ ] Índices sendo usados (verificar `EXPLAIN ANALYZE`)

### ✅ Verificações de Logs

- [ ] Logs de auditoria sendo registrados (tabela `downloads`)
- [ ] IP e User Agent sendo capturados corretamente
- [ ] Logs de erro não mostrando problemas críticos
- [ ] Rate limiting funcionando (verificar logs de 429)

---

## 📊 Monitoramento Contínuo

### Métricas para Monitorar

- [ ] **Taxa de downloads bloqueados**: Percentual de downloads que falharam por limite
- [ ] **Taxa de cache hit**: Percentual de requisições atendidas pelo cache
- [ ] **Tempo médio de resposta**: Performance das APIs
- [ ] **Rate limit hits**: Quantas vezes o rate limit foi acionado
- [ ] **Erros 500**: Frequência de erros internos

### Alertas Recomendados

- [ ] Alertar se taxa de erros 500 > 1%
- [ ] Alertar se tempo médio de resposta > 1s
- [ ] Alertar se rate limit está sendo acionado frequentemente
- [ ] Alertar se cache hit rate < 50%

---

## 🔄 Rollback (Se Necessário)

### Procedimento de Rollback

1. **Reverter código**: Voltar para versão anterior
2. **Manter migrations**: Não reverter migrations (dados já foram inseridos)
3. **Verificar integridade**: Garantir que sistema continua funcionando
4. **Monitorar logs**: Verificar se não há erros após rollback

### ⚠️ Atenção

- **NÃO reverter migrations** que já foram aplicadas em produção
- Se necessário, criar nova migration para corrigir problemas
- Sempre testar rollback em ambiente de staging primeiro

---

## 📝 Checklist Rápido

```
□ Migrations aplicadas (033-037)
□ Variáveis de ambiente configuradas
□ RLS policies ativas
□ Índices criados
□ Build bem-sucedido
□ Deploy realizado
□ Testes funcionais passando
□ Testes de segurança passando
□ Performance adequada
□ Logs sendo registrados
□ Monitoramento configurado
```

---

## 🆘 Troubleshooting Pós-Deploy

### Problema: Downloads não estão sendo bloqueados

**Verificar**:
1. Funções SQL foram criadas?
2. API está chamando `register_download`?
3. Logs mostram erros?

**Solução**: Verificar migrations e logs

### Problema: Contador não atualiza

**Verificar**:
1. Cache está sendo invalidado?
2. Evento `download-completed` está sendo disparado?
3. API `/api/downloads/status` está retornando dados corretos?

**Solução**: Verificar invalidação de cache e eventos

### Problema: Performance lenta

**Verificar**:
1. Índices estão sendo usados?
2. Cache está funcionando?
3. Rate limiting não está muito restritivo?

**Solução**: Verificar `EXPLAIN ANALYZE` e métricas de cache

---

## 📞 Suporte

Em caso de problemas críticos:
1. Verificar logs do servidor
2. Verificar logs do Supabase
3. Consultar documentação técnica (`DOWNLOAD_SYSTEM_API.md` e `DOWNLOAD_SYSTEM_SQL.md`)
4. Revisar migrations aplicadas


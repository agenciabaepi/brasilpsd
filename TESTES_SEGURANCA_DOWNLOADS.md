# 🛡️ Testes de Segurança - Sistema de Downloads

## 📋 Objetivo

Garantir que o sistema de controle de downloads não pode ser burlado e funciona corretamente em todos os cenários.

---

## 🚀 Como Começar

### Passo 1: Obter IDs para Testes

Antes de executar os scripts SQL de teste, você precisa obter IDs reais de usuários e recursos:

1. **Abra o arquivo `OBTER_ID_USUARIO.sql`** no Supabase SQL Editor
2. **Execute as queries** para listar usuários e recursos disponíveis
3. **Copie os IDs** (formato UUID: `3f83bd21-d8ce-483a-a03b-bac87c26337c`)
4. **Substitua** `'USER-ID-AQUI'` e `'RESOURCE-ID-AQUI'` nos scripts de teste pelos IDs reais

⚠️ **IMPORTANTE**: Os placeholders `'USER-ID-AQUI'` não são UUIDs válidos e causarão erro se executados sem substituição!

### Passo 2: Executar Testes SQL

1. Abra `SCRIPTS_TESTE_SEGURANCA.sql` no Supabase SQL Editor
2. Substitua todos os `'USER-ID-AQUI'` pelos IDs obtidos no Passo 1
3. Execute os testes individualmente ou em grupos
4. Verifique os resultados esperados

### Passo 3: Executar Testes de API

1. Abra o Console do navegador (F12)
2. Copie e cole os scripts de `TESTES_API_DOWNLOAD.js`
3. Configure os IDs em `TEST_CONFIG`
4. Execute os testes

---

## 🧪 Cenários de Teste

### ✅ Teste 1: Usuário tenta fazer download sem autenticação

**Objetivo**: Verificar que downloads sem autenticação são bloqueados

**Como testar**:
1. Abra o DevTools (F12) → Network
2. Faça uma requisição direta para a API:
```javascript
fetch('http://localhost:3000/api/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    resourceId: 'algum-resource-id',
    key: 'algum-key'
  })
})
.then(r => r.json())
.then(console.log)
```

**Resultado esperado**:
- Status: `401 Unauthorized`
- Mensagem: "Não autorizado. Faça login para continuar."

**Status**: ⬜ Não testado

---

### ✅ Teste 2: Usuário tenta fazer download após atingir limite

**Objetivo**: Verificar que o sistema bloqueia após atingir o limite

**Como testar**:
1. Faça 10 downloads (limite do plano Pro)
2. Tente fazer o 11º download

**Resultado esperado**:
- Status: `403 Forbidden`
- Mensagem: "Limite de downloads excedido. Você já fez 10 de 10 downloads hoje. Tente novamente amanhã."
- Botão desabilitado e cinza

**Status**: ✅ **TESTADO E FUNCIONANDO** (você confirmou que funcionou!)

---

### ✅ Teste 3: Usuário tenta manipular requisição (bypass frontend)

**Objetivo**: Verificar que manipular requisições não bypassa o sistema

**Como testar**:
1. Faça login normalmente
2. Abra DevTools → Network
3. Intercepte uma requisição de download
4. Tente modificar:
   - Remover autenticação
   - Alterar user_id
   - Alterar resourceId
   - Fazer múltiplas requisições simultâneas

**Script de teste** (cole no console do navegador):
```javascript
// Teste 3.1: Requisição sem token
fetch('http://localhost:3000/api/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ resourceId: 'xxx', key: 'yyy' })
}).then(r => r.json()).then(console.log)

// Teste 3.2: Múltiplas requisições simultâneas (race condition)
for(let i = 0; i < 5; i++) {
  fetch('http://localhost:3000/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceId: 'xxx', key: 'yyy' })
  }).then(r => r.json()).then(d => console.log(`Request ${i}:`, d))
}
```

**Resultado esperado**:
- Todas as requisições devem ser validadas no servidor
- Apenas uma deve ser permitida (LOCK previne race conditions)
- As outras devem retornar erro de limite

**Status**: ⬜ Não testado

---

### ✅ Teste 4: Usuário tenta fazer múltiplos downloads simultâneos

**Objetivo**: Verificar que LOCK previne race conditions

**Como testar**:
1. Tenha 1 download restante
2. Abra 5 abas diferentes
3. Tente fazer download simultaneamente em todas

**Resultado esperado**:
- Apenas 1 download deve ser permitido
- As outras 4 devem retornar erro de limite
- O LOCK na função SQL deve garantir atomicidade

**Status**: ⬜ Não testado

---

### ✅ Teste 5: Usuário tenta fazer download de recurso sem permissão

**Objetivo**: Verificar que recursos não aprovados são bloqueados

**Como testar**:
1. Crie um recurso com status 'pending' ou 'rejected'
2. Tente fazer download (sem ser o criador)

**Resultado esperado**:
- Status: `403 Forbidden`
- Mensagem: "Recurso não disponível para download"
- Criador pode baixar seus próprios recursos mesmo não aprovados

**Status**: ⬜ Não testado

---

### ✅ Teste 6: Verificar que contagem usa timezone correto

**Objetivo**: Verificar que o "dia atual" usa timezone do Brasil

**Script SQL de teste**:
```sql
-- Substitua pelo ID de um usuário real
SELECT 
  NOW() as agora_utc,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brasil,
  CURRENT_DATE as data_atual,
  (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' as inicio_dia_brasil,
  public.count_user_downloads_today('SEU-USER-ID-AQUI'::UUID) as downloads_hoje;
```

**Como testar**:
1. Faça alguns downloads
2. Execute o script acima
3. Verifique que a contagem está correta para o dia atual no horário de Brasília

**Resultado esperado**:
- Contagem considera apenas downloads do dia atual (00:00:00 até 23:59:59 BRT)
- Reset automático à meia-noite (horário de Brasília)

**Status**: ⬜ Não testado

---

### ✅ Teste 7: Verificar reset de contador à meia-noite

**Objetivo**: Verificar que o contador reseta automaticamente

**Como testar**:
1. Faça 10 downloads (atinga o limite)
2. Aguarde até depois da meia-noite (horário de Brasília)
3. Verifique que pode fazer download novamente

**Script SQL para simular** (apenas para teste, não executar em produção):
```sql
-- ATENÇÃO: Apenas para teste em ambiente de desenvolvimento!
-- Simular que já passou a meia-noite alterando created_at
UPDATE public.downloads
SET created_at = created_at - INTERVAL '1 day'
WHERE user_id = 'SEU-USER-ID-AQUI'::UUID
AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;
```

**Resultado esperado**:
- Contador reseta automaticamente à meia-noite
- Usuário pode fazer downloads novamente após reset

**Status**: ⬜ Não testado

---

### ✅ Teste 8: Usuário com plano expirado não pode fazer download

**Objetivo**: Verificar que planos expirados são bloqueados

**Script SQL para testar**:
```sql
-- Criar assinatura expirada para teste
INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  amount,
  billing_cycle,
  start_date,
  current_period_start,
  current_period_end
) VALUES (
  'SEU-USER-ID-AQUI'::UUID,
  'pro',
  'expired',
  10.00,
  'monthly',
  CURRENT_DATE - INTERVAL '2 months',
  CURRENT_DATE - INTERVAL '1 month',
  CURRENT_DATE - INTERVAL '1 day'  -- Expirado
);

-- Verificar status de downloads
SELECT * FROM public.get_user_download_status('SEU-USER-ID-AQUI'::UUID);
```

**Resultado esperado**:
- Sistema deve detectar que assinatura expirada
- Deve usar tier 'free' (limite de 1 download)
- Ou bloquear completamente (dependendo da regra de negócio)

**Status**: ⬜ Não testado

---

### ✅ Teste 9: Múltiplos usuários fazendo download simultaneamente

**Objetivo**: Verificar que não há interferência entre usuários

**Como testar**:
1. Tenha 2 usuários diferentes logados
2. Ambos fazem downloads simultaneamente
3. Verifique que os contadores são independentes

**Resultado esperado**:
- Cada usuário tem seu próprio contador
- Downloads de um usuário não afetam o outro
- LOCK funciona por usuário (não global)

**Status**: ⬜ Não testado

---

### ✅ Teste 10: Verificar integridade transacional (rollback em erro)

**Objetivo**: Verificar que erros fazem rollback correto

**Script SQL para testar**:
```sql
-- Simular erro durante registro de download
-- A função register_download deve fazer rollback se algo falhar

-- Verificar que não há downloads "órfãos" (sem registro completo)
SELECT 
  d.id,
  d.user_id,
  d.resource_id,
  d.created_at,
  r.title as resource_title
FROM public.downloads d
LEFT JOIN public.resources r ON r.id = d.resource_id
WHERE r.id IS NULL;  -- Downloads de recursos que não existem mais
```

**Resultado esperado**:
- Se registro falhar, nenhum download deve ser inserido
- Transação deve fazer rollback completo
- Não deve haver downloads "órfãos"

**Status**: ⬜ Não testado

---

## 🔍 Testes Adicionais de Segurança

### ✅ Teste 11: Verificar que IP e User Agent são registrados

**Script SQL**:
```sql
SELECT 
  id,
  user_id,
  ip_address,
  user_agent,
  created_at
FROM public.downloads
WHERE user_id = 'SEU-USER-ID-AQUI'::UUID
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado**:
- Todos os downloads devem ter `ip_address` e `user_agent` registrados
- Valores não devem ser NULL

**Status**: ⬜ Não testado

---

### ✅ Teste 12: Verificar que trigger bloqueia inserção direta

**Objetivo**: Verificar que trigger impede bypass da função RPC

**Script SQL**:
```sql
-- Tentar inserir download diretamente (deve ser bloqueado pelo trigger)
INSERT INTO public.downloads (user_id, resource_id)
VALUES (
  'SEU-USER-ID-AQUI'::UUID,
  'ALGUM-RESOURCE-ID'::UUID
);
```

**Resultado esperado**:
- Deve retornar erro: "Limite de downloads excedido"
- Trigger deve validar antes de permitir inserção

**Status**: ⬜ Não testado

---

### ✅ Teste 13: Verificar performance com muitos downloads

**Objetivo**: Verificar que índices funcionam corretamente

**Script SQL**:
```sql
-- Verificar tempo de execução da contagem
EXPLAIN ANALYZE
SELECT public.count_user_downloads_today('SEU-USER-ID-AQUI'::UUID);

-- Verificar se índices estão sendo usados
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM public.downloads
WHERE user_id = 'SEU-USER-ID-AQUI'::UUID
  AND created_at >= (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
```

**Resultado esperado**:
- Query deve usar índice `idx_downloads_user_created_at`
- Tempo de execução deve ser < 100ms mesmo com muitos downloads

**Status**: ⬜ Não testado

---

## 📊 Checklist de Testes

- [ ] Teste 1: Download sem autenticação
- [x] Teste 2: Limite de downloads ✅ **TESTADO**
- [ ] Teste 3: Manipulação de requisição
- [ ] Teste 4: Downloads simultâneos
- [ ] Teste 5: Recurso sem permissão
- [ ] Teste 6: Timezone correto
- [ ] Teste 7: Reset à meia-noite
- [ ] Teste 8: Plano expirado
- [ ] Teste 9: Múltiplos usuários
- [ ] Teste 10: Integridade transacional
- [ ] Teste 11: IP e User Agent
- [ ] Teste 12: Trigger bloqueia inserção direta
- [ ] Teste 13: Performance

---

## 🛠️ Scripts de Teste Automatizado (Opcional)

### Script para testar todos os cenários

```sql
-- Script completo de testes (executar no Supabase SQL Editor)
-- Substitua os IDs pelos valores reais

DO $$
DECLARE
  test_user_id UUID := 'SEU-USER-ID-AQUI'::UUID;
  test_resource_id UUID := 'ALGUM-RESOURCE-ID'::UUID;
  test_result RECORD;
BEGIN
  RAISE NOTICE '🧪 Iniciando testes de segurança...';
  
  -- Teste: Verificar função check_download_limit
  SELECT * INTO test_result
  FROM public.check_download_limit(test_user_id);
  
  RAISE NOTICE '✅ Teste 1: check_download_limit funcionando';
  RAISE NOTICE '   - Allowed: %', test_result.allowed;
  RAISE NOTICE '   - Current: %', test_result.current_count;
  RAISE NOTICE '   - Limit: %', test_result.limit_count;
  RAISE NOTICE '   - Remaining: %', test_result.remaining;
  
  -- Teste: Verificar função get_user_download_status
  SELECT * INTO test_result
  FROM public.get_user_download_status(test_user_id);
  
  RAISE NOTICE '✅ Teste 2: get_user_download_status funcionando';
  RAISE NOTICE '   - Tier: %', test_result.tier;
  
  -- Teste: Verificar contagem
  RAISE NOTICE '✅ Teste 3: count_user_downloads_today = %', 
    public.count_user_downloads_today(test_user_id);
  
  RAISE NOTICE '✅ Todos os testes básicos passaram!';
END $$;
```

---

## 📝 Notas de Teste

### Como registrar resultados

Após cada teste, atualize este documento marcando:
- ✅ Passou
- ❌ Falhou (com descrição do erro)
- ⬜ Não testado

### Ambiente de Teste

- **Desenvolvimento**: Use dados de teste
- **Staging**: Teste com dados mais próximos da produção
- **Produção**: Apenas testes não destrutivos

---

## 🚨 Problemas Encontrados

_(Registre aqui qualquer problema encontrado durante os testes)_

---

**Última atualização**: [Data será preenchida durante testes]
**Testado por**: [Nome será preenchido]


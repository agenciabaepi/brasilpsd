# Verificação do Sistema de Downloads Diários

## Como verificar se está funcionando

### 1. Verificar se as funções SQL existem

Execute no Supabase SQL Editor:

```sql
-- Verificar se a função existe
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
```

**Resultado esperado**: Deve retornar todas as 5 funções listadas.

---

### 2. Obter ID do usuário primeiro

```sql
-- Opção 1: Se você souber o email
SELECT id, email, full_name FROM public.profiles 
WHERE email = 'seu-email@exemplo.com' LIMIT 1;

-- Opção 2: Ver todos os usuários
SELECT id, email, full_name FROM public.profiles LIMIT 10;
```

**⚠️ IMPORTANTE**: Copie o ID (UUID) retornado para usar nas próximas queries.

### 3. Testar contagem de downloads únicos

```sql
-- Substitua '00000000-0000-0000-0000-000000000000' pelo ID real obtido acima
SELECT public.count_unique_resources_downloaded_today('00000000-0000-0000-0000-000000000000'::UUID) as downloads_hoje;
```

**Resultado esperado**: Deve retornar um número (ex: 0, 1, 2, etc.)

---

### 4. Testar verificação de recurso já baixado

```sql
-- Substitua pelos IDs reais (obtenha o resource_id de uma query anterior)
SELECT public.has_user_downloaded_resource_today(
  '00000000-0000-0000-0000-000000000000'::UUID,  -- User ID
  '00000000-0000-0000-0000-000000000000'::UUID   -- Resource ID
) as ja_baixado_hoje;
```

**Resultado esperado**: `true` se já baixou hoje, `false` caso contrário.

---

### 5. Testar status completo

```sql
-- Substitua pelo ID real do usuário
SELECT * FROM public.get_user_download_status('00000000-0000-0000-0000-000000000000'::UUID);
```

**Resultado esperado**:
- `current_count`: Número de recursos únicos baixados hoje
- `limit_count`: Limite do plano (1, 3, 10 ou 20)
- `remaining`: Downloads restantes
- `allowed`: `true` se pode baixar, `false` se atingiu o limite
- `tier`: Plano do usuário ('free', 'lite', 'pro', 'plus')

---

### 6. Verificar timezone

```sql
-- Verificar qual é o "hoje" que o sistema está usando
SELECT 
  CURRENT_DATE as data_atual_utc,
  (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' as inicio_dia_brasil,
  (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day' as fim_dia_brasil;
```

**Resultado esperado**: Deve mostrar o início e fim do dia atual no horário de Brasília.

---

### 7. Testar com dados reais

```sql
-- Ver downloads de hoje de um usuário específico
-- ⚠️ Substitua pelo ID real do usuário
SELECT 
  d.id,
  d.resource_id,
  r.title as resource_title,
  d.created_at,
  d.downloaded_at,
  DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') as dia_brasil
FROM public.downloads d
LEFT JOIN public.resources r ON r.id = d.resource_id
WHERE d.user_id = '00000000-0000-0000-0000-000000000000'::UUID
  AND DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY d.created_at DESC;
```

**Resultado esperado**: Lista todos os downloads do usuário feitos hoje (no horário de Brasília).

---

### 8. Verificar contagem de recursos únicos

```sql
-- Contar recursos únicos baixados hoje
-- ⚠️ Substitua pelo ID real do usuário
SELECT 
  COUNT(DISTINCT d.resource_id) as recursos_unicos_hoje,
  COUNT(*) as total_downloads_hoje
FROM public.downloads d
WHERE d.user_id = '00000000-0000-0000-0000-000000000000'::UUID
  AND DATE(COALESCE(d.created_at, d.downloaded_at) AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;
```

**Resultado esperado**: 
- `recursos_unicos_hoje`: Deve ser igual ao resultado de `count_unique_resources_downloaded_today`
- `total_downloads_hoje`: Pode ser maior se o usuário baixou o mesmo arquivo várias vezes

---

## Problemas comuns e soluções

### ❌ Problema: Função não existe
**Sintoma**: Erro "function does not exist"
**Solução**: Aplicar a migration `047_implement_unique_downloads_per_day.sql` no Supabase SQL Editor

### ❌ Problema: Contagem sempre retorna 0
**Sintoma**: `count_unique_resources_downloaded_today` sempre retorna 0 mesmo com downloads
**Possíveis causas**:
1. Timezone incorreto - verificar se os downloads estão sendo salvos com timezone correto
2. Data incorreta - verificar se `created_at` ou `downloaded_at` estão preenchidos

### ❌ Problema: Contagem não atualiza após download
**Sintoma**: Após fazer download, o contador não aumenta
**Possíveis causas**:
1. Cache não sendo limpo - verificar se `deleteCacheByPrefix` está sendo chamado
2. Função `register_download` não está sendo chamada corretamente

### ❌ Problema: Múltiplos downloads do mesmo arquivo contam como vários
**Sintoma**: Baixar o mesmo arquivo 3 vezes conta como 3 downloads
**Solução**: Verificar se a função está usando `COUNT(DISTINCT resource_id)`

---

## Checklist de funcionamento

- [ ] Funções SQL existem no banco
- [ ] `count_unique_resources_downloaded_today` retorna número correto
- [ ] `has_user_downloaded_resource_today` funciona corretamente
- [ ] `get_user_download_status` retorna dados corretos
- [ ] Timezone está configurado para `America/Sao_Paulo`
- [ ] Contagem reseta à meia-noite (00:00)
- [ ] Múltiplos downloads do mesmo arquivo contam apenas como 1
- [ ] Limite é respeitado corretamente
- [ ] Cache é limpo após downloads


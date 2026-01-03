# Debug: Downloads não estão sendo contados

## Problema
Os downloads não estão sendo descontados do limite diário do usuário.

## Verificações Necessárias

### 1. Verificar se a Migration 047 foi aplicada

Execute no Supabase SQL Editor:

```sql
-- Verificar se a função existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'count_unique_resources_downloaded_today';

-- Verificar se register_download tem o campo is_new_download
SELECT proname, prorettype::regtype
FROM pg_proc 
WHERE proname = 'register_download';
```

**Se as funções não existirem:**
1. Acesse o SQL Editor no Supabase
2. Execute o arquivo: `supabase/migrations/047_implement_unique_downloads_per_day.sql`
3. Verifique se não há erros

### 2. Verificar se os downloads estão sendo registrados

Execute no Supabase SQL Editor:

```sql
-- Ver downloads de hoje de um usuário específico
SELECT 
  d.id,
  d.user_id,
  d.resource_id,
  d.created_at,
  d.downloaded_at,
  r.title as resource_title
FROM downloads d
LEFT JOIN resources r ON r.id = d.resource_id
WHERE d.user_id = 'SEU_USER_ID_AQUI'
  AND DATE(d.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY d.created_at DESC;
```

### 3. Testar a função de contagem

Execute no Supabase SQL Editor:

```sql
-- Testar contagem de recursos únicos
SELECT public.count_unique_resources_downloaded_today('SEU_USER_ID_AQUI');

-- Testar status completo
SELECT * FROM public.get_user_download_status('SEU_USER_ID_AQUI');
```

### 4. Verificar logs do servidor

Após fazer um download, verifique os logs do servidor (terminal onde está rodando `npm run dev`):

Procure por:
- `📊 Unique resources downloaded today`
- `✅ Download authorized`
- `📥 RPC result`

### 5. Verificar se o cache está sendo limpo

Após fazer um download, verifique se:
1. O cache está sendo limpo (procure por `deleteCacheByPrefix` nos logs)
2. A API `/api/downloads/status` está retornando valores atualizados

## Soluções

### Solução 1: Aplicar Migration Manualmente

Se a migration não foi aplicada:

1. Copie o conteúdo de `supabase/migrations/047_implement_unique_downloads_per_day.sql`
2. Cole no SQL Editor do Supabase
3. Execute
4. Verifique se não há erros

### Solução 2: Verificar se a função está sendo chamada

Adicione logs temporários no código:

```typescript
// Em lib/utils/downloads.ts, linha ~59
console.log('🔍 Calling count_unique_resources_downloaded_today for user:', userId)
const { data: uniqueCount, error: countError } = await supabase
  .rpc('count_unique_resources_downloaded_today', {
    p_user_id: userId
  })
console.log('📊 Result:', { uniqueCount, countError })
```

### Solução 3: Forçar atualização do status

No componente, após o download, force uma atualização:

```typescript
// Após download bem-sucedido
setTimeout(() => {
  // Forçar atualização com timestamp
  fetch(`/api/downloads/status?t=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      setDownloadStatus(data)
    })
}, 2000)
```

## Teste Manual

1. Faça um download de um recurso novo
2. Verifique no banco se o download foi registrado:
   ```sql
   SELECT * FROM downloads 
   WHERE user_id = 'SEU_ID' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. Verifique a contagem:
   ```sql
   SELECT public.count_unique_resources_downloaded_today('SEU_ID');
   ```
4. Verifique se o contador na UI atualiza

## Possíveis Causas

1. **Migration não aplicada**: A função `count_unique_resources_downloaded_today` não existe
2. **Cache não sendo limpo**: O status está sendo servido do cache antigo
3. **Função retornando valores errados**: A função SQL pode ter um bug
4. **Timezone**: Problema com timezone do Brasil vs UTC
5. **Função register_download não atualizada**: A função pode não estar retornando `is_new_download` corretamente

## Próximos Passos

1. Execute as verificações acima
2. Envie os resultados dos logs
3. Envie o resultado das queries SQL
4. Com essas informações, poderemos identificar o problema exato


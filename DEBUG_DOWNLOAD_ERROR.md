# Debug: Erro 500 no Download

## Problema
Erro 500 ao tentar fazer download de recursos.

## Possíveis Causas

### 1. Migration não aplicada
A migration `035_fix_register_download_validation.sql` precisa ser aplicada no banco de dados.

**Solução:**
```sql
-- Aplicar a migration no Supabase SQL Editor
-- Copiar e colar o conteúdo de:
-- supabase/migrations/035_fix_register_download_validation.sql
```

### 2. Função RPC não existe
A função `register_download` pode não existir no banco.

**Verificação:**
```sql
-- Verificar se a função existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'register_download';
```

### 3. Permissões insuficientes
A função pode não ter permissões para ser executada.

**Solução:**
```sql
GRANT EXECUTE ON FUNCTION public.register_download(UUID, UUID, TEXT, TEXT) TO authenticated;
```

## Como debugar

### 1. Verificar logs do servidor
No terminal onde o Next.js está rodando, procure por:
- `❌ Download failed: Error registering download`
- `❌ RPC Error details:`

### 2. Verificar no console do navegador
Abra o DevTools (F12) e veja a resposta da requisição em Network:
- Status: 500
- Response: deve conter detalhes do erro em desenvolvimento

### 3. Testar função diretamente no Supabase
```sql
-- Testar a função diretamente
SELECT * FROM public.register_download(
  'user-id-aqui'::UUID,
  'resource-id-aqui'::UUID,
  '127.0.0.1',
  'Mozilla/5.0...'
);
```

## Checklist

- [ ] Migration 033 aplicada (estrutura do banco)
- [ ] Migration 034 aplicada (funções de validação)
- [ ] Migration 035 aplicada (correção da função)
- [ ] Permissões GRANT aplicadas
- [ ] Função existe no banco
- [ ] Logs do servidor verificados

## Próximos passos

1. Aplicar todas as migrations pendentes
2. Verificar logs do servidor para erro específico
3. Testar função diretamente no Supabase SQL Editor
4. Verificar se o usuário tem permissões adequadas


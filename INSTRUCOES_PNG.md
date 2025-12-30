# 🔧 Instruções para Adicionar 'png' ao Enum

## ⚠️ IMPORTANTE: Execute os comandos nesta ordem

### Passo 1: Adicionar 'png' ao enum (EXECUTE SOZINHO)

No SQL Editor do Supabase, execute **APENAS** este comando:

```sql
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'png';
```

**⚠️ CRÍTICO:** 
- Execute **SOMENTE** este comando
- Não adicione nenhuma outra query na mesma execução
- Aguarde a confirmação de sucesso
- Feche e reabra o SQL Editor (ou aguarde alguns segundos)

### Passo 2: Verificar se foi adicionado (EXECUTE SEPARADAMENTE)

Depois de alguns segundos, execute esta query para verificar:

```sql
SELECT unnest(enum_range(NULL::resource_type)) AS enum_value
ORDER BY enum_value;
```

Você deve ver 'png' na lista.

### Passo 3: Testar upload

Agora você pode fazer upload de arquivos PNG e eles serão salvos corretamente como `resource_type = 'png'`.

---

## 🔍 Se ainda der erro

Se mesmo após executar o Passo 1 você ainda receber o erro "unsafe use of new value", tente:

1. **Reiniciar a conexão do Supabase:**
   - Feche completamente o SQL Editor
   - Aguarde 10-15 segundos
   - Abra novamente

2. **Verificar se o valor foi realmente adicionado:**
```sql
SELECT 
  e.enumlabel AS value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'resource_type'
ORDER BY e.enumsortorder;
```

3. **Se 'png' não aparecer na lista acima**, execute novamente:
```sql
ALTER TYPE resource_type ADD VALUE 'png';
```
(Sem o `IF NOT EXISTS` - isso força a adição mesmo se já existir)

---

## ✅ Após adicionar com sucesso

Uma vez que 'png' esteja no enum e commitado, todas as funções e o código da aplicação funcionarão normalmente.




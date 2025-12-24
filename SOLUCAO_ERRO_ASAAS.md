# 🔧 Solução: Erro "Asaas não configurado"

## ✅ Verificação

A variável `ASAAS_API_KEY` já está no seu `.env.local`, mas o erro persiste.

## 🎯 Solução Rápida

### 1. Reiniciar o Servidor

**IMPORTANTE**: Após modificar o `.env.local`, você **DEVE** reiniciar o servidor:

```bash
# Pare o servidor (pressione Ctrl+C no terminal onde está rodando)
# Depois inicie novamente:
npm run dev
```

### 2. Verificar o Formato da Variável

No seu `.env.local`, certifique-se de que está assim (sem aspas):

```env
ASAAS_API_KEY=aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjQ2MmFmNjFjLTg4ODYtNGM0MS05MDAwLTM0N2U0NDE2NGIxOTo6JGFhY2hfNGEyMGVmMjQtNWFkYy00NWFkLThhOTQtZmNlNWM1NTI3NDYx
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
```

**NÃO use aspas:**
```env
# ❌ ERRADO
ASAAS_API_KEY="aact_hmlg_..."

# ✅ CORRETO
ASAAS_API_KEY=aact_hmlg_...
```

### 3. Verificar se não há espaços

Certifique-se de que não há espaços antes ou depois do `=`:

```env
# ❌ ERRADO
ASAAS_API_KEY = aact_hmlg_...

# ✅ CORRETO
ASAAS_API_KEY=aact_hmlg_...
```

### 4. Limpar Cache do Next.js (se necessário)

Se ainda não funcionar, limpe o cache:

```bash
# Pare o servidor
# Delete a pasta .next
rm -rf .next

# Inicie novamente
npm run dev
```

## 🧪 Testar se está funcionando

Após reiniciar, tente criar uma assinatura novamente. Se o erro persistir:

1. Verifique os logs do servidor no terminal
2. Verifique se a variável está sendo lida:
   - Adicione um `console.log` temporário no código para verificar
   - Ou verifique os logs do servidor ao iniciar

## 📞 Se ainda não funcionar

Verifique:
- ✅ O arquivo está na raiz do projeto (mesmo nível do `package.json`)
- ✅ O nome do arquivo é exatamente `.env.local` (com ponto no início)
- ✅ Não há erros de sintaxe no arquivo
- ✅ O servidor foi reiniciado após as mudanças


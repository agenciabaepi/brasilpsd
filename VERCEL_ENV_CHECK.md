# Verificação de Variáveis de Ambiente no Vercel

## Problema: QR Code funciona em localhost mas não funciona online

Se o QR Code funciona em localhost mas não funciona no site online (Vercel), pode ser um problema de configuração de variáveis de ambiente.

## ✅ Solução: Verificar Variáveis no Vercel

### 1. Acesse o Painel do Vercel

1. Vá para: https://vercel.com/dashboard
2. Selecione seu projeto (BrasilPsd)
3. Vá em **Settings** > **Environment Variables**

### 2. Verifique as Variáveis do Asaas

Certifique-se de que as seguintes variáveis estão configuradas:

```env
ASAAS_API_KEY=sua_chave_api_aqui
ASAAS_API_URL=https://api.asaas.com/v3
```

**⚠️ IMPORTANTE:**
- Se em **localhost** você usa `sandbox`, mas em **produção** usa produção, certifique-se de que:
  - A conta Asaas em **produção** tem chave PIX cadastrada
  - A API Key de **produção** está configurada no Vercel
  - A URL está correta: `https://api.asaas.com/v3` (sem "sandbox")

### 3. Diferenças entre Sandbox e Produção

| Ambiente | URL | Quando Usar |
|----------|-----|-------------|
| **Sandbox** | `https://sandbox.asaas.com/api/v3` | Desenvolvimento/Testes |
| **Produção** | `https://api.asaas.com/v3` | Site online real |

### 4. Ambiente Recomendado

Para o site online (brasilpsd.com.br), use **PRODUÇÃO**:

```env
ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_API_KEY=sua_chave_api_producao
```

### 5. Verificar se Chave PIX está Cadastrada

1. Acesse o painel do Asaas:
   - Produção: https://www.asaas.com
   - Sandbox: https://sandbox.asaas.com

2. Vá em **Configurações** > **Integrações** > **PIX**
3. Verifique se há uma chave PIX cadastrada e ativa
4. Se não houver, cadastre uma chave PIX

### 6. Após Ajustar Variáveis no Vercel

1. **Redeploy** é necessário após alterar variáveis de ambiente
2. Vá em **Deployments** no Vercel
3. Clique nos 3 pontos (...) do último deployment
4. Selecione **Redeploy**

Ou simplesmente faça um novo commit para trigger um novo deploy.

### 7. Verificar Logs no Vercel

1. Vá em **Deployments** > Selecione o último deployment
2. Clique em **Functions** > Selecione a função `/api/finance/checkout`
3. Verifique os logs para ver:
   - Qual API URL está sendo usada
   - Qual ambiente (SANDBOX ou PRODUÇÃO)
   - Erros específicos do QR Code

## 🔍 Checklist

- [ ] Variável `ASAAS_API_URL` configurada no Vercel
- [ ] Variável `ASAAS_API_KEY` configurada no Vercel
- [ ] URL correta para produção: `https://api.asaas.com/v3` (sem "sandbox")
- [ ] Chave PIX cadastrada na conta Asaas de produção
- [ ] Redeploy feito após alterar variáveis
- [ ] Logs verificados para confirmar ambiente

## 📝 Nota Importante

Se você está usando **sandbox** em localhost e **produção** no Vercel, certifique-se de que:
- A conta Asaas em **produção** está configurada corretamente
- A chave PIX está cadastrada na conta de **produção**
- As variáveis de ambiente no Vercel estão apontando para **produção**





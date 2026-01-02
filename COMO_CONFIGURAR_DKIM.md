# 🔑 Como Configurar DKIM (Falta Apenas Isso!)

## ✅ Status Atual

- ✅ **SPF:** Configurado e funcionando
- ✅ **DMARC:** Configurado e funcionando
- ❌ **DKIM:** Ainda não configurado

## 🎯 Passo a Passo para Configurar DKIM

### Passo 1: Obter DKIM da Hostinger

1. **Acesse o painel da Hostinger:**
   - Vá para: https://hpanel.hostinger.com.br/ (ou seu painel da Hostinger)
   - Faça login

2. **Navegue até as configurações de email:**
   - Procure por **"Emails"** ou **"Email Accounts"**
   - Vá em **"Configurações"** ou **"Settings"**
   - Procure por **"Custom DKIM"** ou **"DKIM"**

3. **Ativar DKIM (se não estiver ativo):**
   - Se houver um botão para ativar, clique nele
   - Aguarde alguns minutos para o DKIM ser gerado

4. **Copiar informações do DKIM:**
   - Você verá algo como:
     - **Nome do registro:** `default._domainkey` ou `hostinger._domainkey` ou similar
     - **Valor do registro:** Uma string longa começando com `v=DKIM1; k=rsa; p=...`
   - **Copie ambos** (nome e valor)

### Passo 2: Adicionar DKIM na Vercel

1. **Acesse o painel da Vercel:**
   - Vá para: https://vercel.com/dashboard
   - Selecione seu projeto
   - Vá em **Settings** > **Domains**
   - Clique no domínio `brasilpsd.com.br`
   - Vá na aba **DNS Records** ou **DNS**

2. **Adicionar registro DKIM:**
   - Clique em **Add Record** ou **Add DNS Record**
   - Configure:
     - **Type:** `TXT`
     - **Name:** (cole o nome que você copiou da Hostinger, ex: `default._domainkey`)
     - **Value:** (cole o valor completo que você copiou da Hostinger)
     - **TTL:** 3600 (ou Auto)

3. **Salvar o registro**

### Passo 3: Aguardar Propagação

- **Mínimo:** 1-2 horas
- **Recomendado:** 2-4 horas
- **Máximo:** 48 horas

### Passo 4: Verificar

Após aguardar, acesse novamente:
```
https://www.brasilpsd.com.br/api/auth/check-dns
```

Deve mostrar:
```json
{
  "summary": {
    "allConfigured": true,
    "spfConfigured": true,
    "dmarcConfigured": true,
    "dkimConfigured": true  ← Deve ser true agora!
  }
}
```

## 📍 Onde Encontrar DKIM na Hostinger

A interface da Hostinger pode variar, mas geralmente está em:

**Opção 1:**
- Painel → **Emails** → **Configurações** → **Custom DKIM**

**Opção 2:**
- Painel → **Email Accounts** → **Advanced** → **DKIM**

**Opção 3:**
- Painel → **Domains** → `brasilpsd.com.br` → **Email Settings** → **DKIM**

**Opção 4:**
- Procure por "DKIM" na barra de busca do painel

## ⚠️ Problemas Comuns

### "Não encontro DKIM na Hostinger"

1. Certifique-se de que você tem uma conta de email ativa na Hostinger
2. O DKIM pode estar em uma seção diferente - procure por "Email Settings" ou "Advanced"
3. Se não encontrar, entre em contato com o suporte da Hostinger

### "O valor do DKIM é muito longo"

- A Vercel suporta valores longos
- Certifique-se de copiar o valor completo (pode ter várias linhas)
- Remova quebras de linha desnecessárias, mas mantenha o valor completo

### "O nome do registro não funciona"

- O nome geralmente é algo como:
  - `default._domainkey`
  - `hostinger._domainkey`
  - `mail._domainkey`
  - `selector1._domainkey`
- Use exatamente o nome fornecido pela Hostinger

## 🧪 Verificar DKIM Manualmente

Após configurar, você pode verificar via terminal:

```bash
nslookup -type=TXT default._domainkey.brasilpsd.com.br
```

(Substitua `default._domainkey` pelo nome que você usou)

Ou use ferramentas online:
- **MXToolbox DKIM:** https://mxtoolbox.com/dkim.aspx
- Digite: `default._domainkey.brasilpsd.com.br` (ou o nome que você usou)

## ✅ Após Configurar DKIM

1. ✅ Aguarde 2-4 horas para propagação
2. ✅ Verifique com `/api/auth/check-dns` (deve mostrar `dkimConfigured: true`)
3. ✅ Teste enviando email para Gmail
4. ✅ Use Mail-Tester para verificar pontuação (deve ser 10/10)

## 🎯 Resumo

Você já tem:
- ✅ SPF configurado
- ✅ DMARC configurado

Falta apenas:
- ❌ DKIM (obter da Hostinger e adicionar na Vercel)

**Depois de configurar o DKIM e aguardar propagação, tudo deve funcionar!**


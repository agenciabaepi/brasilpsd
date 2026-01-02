# 🔧 Configurar DNS na Vercel para Gmail Receber Emails

## 📋 Situação

- Domínio comprado na **Hostinger**
- DNS apontado para **Vercel** (nameservers da Vercel)
- Emails não chegam no Gmail porque **SPF, DKIM e DMARC não estão configurados**

## ✅ Solução: Configurar DNS na Vercel

Como o DNS está gerenciado pela Vercel, você precisa adicionar os registros DNS **no painel da Vercel**.

### Passo 1: Acessar DNS na Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **Domains**
4. Clique no domínio `brasilpsd.com.br`
5. Vá na aba **DNS Records** ou **DNS**

### Passo 2: Adicionar Registro SPF (TXT)

1. Clique em **Add Record** ou **Add DNS Record**
2. Configure:
   - **Type:** `TXT`
   - **Name:** `@` (ou deixe em branco para raiz do domínio)
   - **Value:** `v=spf1 include:_spf.hostinger.com ~all`
   - **TTL:** 3600 (ou Auto)

3. Salve o registro

### Passo 3: Adicionar Registro DMARC (TXT)

1. Clique em **Add Record**
2. Configure:
   - **Type:** `TXT`
   - **Name:** `_dmarc`
   - **Value:** `v=DMARC1; p=none; rua=mailto:suporte@brasilpsd.com.br; ruf=mailto:suporte@brasilpsd.com.br`
   - **TTL:** 3600 (ou Auto)

3. Salve o registro

### Passo 4: Obter e Adicionar DKIM da Hostinger

#### 4.1: Obter DKIM da Hostinger

1. Acesse o painel da Hostinger
2. Vá em **Emails** > **Configurações** > **Custom DKIM**
3. Se não estiver ativo, **ative o DKIM**
4. Copie:
   - O **nome do registro** (ex: `default._domainkey` ou `hostinger._domainkey`)
   - O **valor completo** do registro DKIM

#### 4.2: Adicionar DKIM na Vercel

1. No painel DNS da Vercel, clique em **Add Record**
2. Configure:
   - **Type:** `TXT`
   - **Name:** (o nome fornecido pela Hostinger, ex: `default._domainkey`)
   - **Value:** (o valor completo fornecido pela Hostinger)
   - **TTL:** 3600 (ou Auto)

3. Salve o registro

## 📊 Resumo dos 3 Registros na Vercel

| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:_spf.hostinger.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:suporte@brasilpsd.com.br; ruf=mailto:suporte@brasilpsd.com.br` |
| TXT | `default._domainkey`* | *(obter da Hostinger)* |

*Substitua `default._domainkey` pelo nome fornecido pela Hostinger

## ⏰ Após Configurar

### 1. Aguardar Propagação

- **Mínimo:** 1-2 horas
- **Recomendado:** 4-6 horas
- **Máximo:** 48 horas

### 2. Verificar se Está Funcionando

Após aguardar, acesse:
```
https://www.brasilpsd.com.br/api/auth/check-dns
```

Ou use ferramentas online:
- **MXToolbox SPF:** https://mxtoolbox.com/spf.aspx
- **MXToolbox DMARC:** https://mxtoolbox.com/dmarc.aspx
- **MXToolbox DKIM:** https://mxtoolbox.com/dkim.aspx

### 3. Testar Envio

1. Envie um email de verificação para uma conta Gmail
2. Verifique se chegou (incluindo pasta de spam)
3. Se não chegou, aguarde mais algumas horas

## 🎯 Localização Exata na Vercel

A interface da Vercel pode variar, mas geralmente:

1. **Dashboard** → Seu Projeto → **Settings** → **Domains**
2. Clique no domínio `brasilpsd.com.br`
3. Procure por **DNS Records** ou **DNS Configuration**
4. Adicione os registros TXT conforme acima

## ⚠️ Importante

- ✅ Os registros DNS devem ser adicionados na **Vercel** (não na Hostinger)
- ✅ O email SMTP continua usando a **Hostinger** (`smtp.hostinger.com`)
- ✅ O SPF aponta para `_spf.hostinger.com` porque o email é enviado pela Hostinger
- ✅ O DKIM é obtido da Hostinger porque o email é enviado pela Hostinger

## 🧪 Verificar Via Terminal

Após configurar e aguardar propagação:

```bash
# SPF
nslookup -type=TXT brasilpsd.com.br

# DMARC
nslookup -type=TXT _dmarc.brasilpsd.com.br

# DKIM (substitua pelo nome correto)
nslookup -type=TXT default._domainkey.brasilpsd.com.br
```

## 📝 Checklist

- [ ] Acessou DNS na Vercel (Settings > Domains > brasilpsd.com.br)
- [ ] Adicionou SPF (TXT @ com valor SPF)
- [ ] Adicionou DMARC (TXT _dmarc)
- [ ] Obteve DKIM da Hostinger
- [ ] Adicionou DKIM na Vercel (TXT com nome da Hostinger)
- [ ] Aguardou 4-6 horas
- [ ] Verificou com `/api/auth/check-dns`
- [ ] Testou com Mail-Tester (https://www.mail-tester.com/)
- [ ] Enviou email de teste para Gmail

## 🆘 Problemas Comuns

### "Não encontro onde adicionar DNS na Vercel"

1. Certifique-se de que o domínio está realmente configurado na Vercel
2. Verifique se você tem permissões de administrador no projeto
3. A interface pode variar - procure por "DNS", "DNS Records", ou "DNS Configuration"

### "O valor do DKIM é muito longo"

- A Vercel suporta valores longos
- Se houver problema, verifique se copiou o valor completo da Hostinger
- Alguns valores DKIM podem ter espaços - remova-os ou mantenha conforme fornecido

### "Ainda não funciona após configurar"

1. Aguarde mais tempo (até 48 horas)
2. Verifique se os registros estão corretos na Vercel
3. Use ferramentas online (MXToolbox) para verificar propagação
4. Verifique se não há erros de digitação

## ✅ Após Configurar Tudo

1. ✅ Aguarde 4-6 horas para propagação
2. ✅ Verifique com `/api/auth/check-dns` (deve mostrar `allConfigured: true`)
3. ✅ Teste enviando email para Gmail
4. ✅ Se funcionar, os emails devem começar a chegar normalmente!

**Configure os 3 registros TXT na Vercel e aguarde a propagação!**


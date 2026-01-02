# 🚨 Problema: Gmail Não Recebe Emails - Solução DNS

## Diagnóstico

Se os emails **chegam no Outlook mas não no Gmail**, o problema é quase certamente **configuração DNS** (SPF, DKIM, DMARC).

O Gmail é **muito mais rigoroso** que outros provedores e **bloqueia silenciosamente** emails sem autenticação adequada.

## ✅ Solução: Configurar DNS

### 1. Verificar DNS Atual

Acesse: `https://seu-dominio.com/api/auth/check-dns`

Ou use ferramentas online:
- **MXToolbox SPF:** https://mxtoolbox.com/spf.aspx
- **MXToolbox DMARC:** https://mxtoolbox.com/dmarc.aspx
- **MXToolbox DKIM:** https://mxtoolbox.com/dkim.aspx

### 2. Configurar SPF (TXT Record)

**No DNS do domínio `brasilpsd.com.br`:**

- **Tipo:** TXT
- **Nome/Host:** `@` (ou `brasilpsd.com.br`)
- **Valor:** `v=spf1 include:_spf.hostinger.com ~all`

**Verificar:**
```bash
nslookup -type=TXT brasilpsd.com.br
```

### 3. Configurar DKIM

**No painel da Hostinger:**
1. Acesse: **Emails** > **Configurações** > **Custom DKIM**
2. Gere/Ative o DKIM se ainda não estiver ativo
3. Copie o registro DKIM fornecido

**No DNS:**
- **Tipo:** TXT
- **Nome/Host:** (o fornecido pela Hostinger, ex: `default._domainkey` ou `hostinger._domainkey`)
- **Valor:** (o valor completo fornecido pela Hostinger)

**Verificar:**
```bash
nslookup -type=TXT default._domainkey.brasilpsd.com.br
```
(Substitua `default._domainkey` pelo nome fornecido pela Hostinger)

### 4. Configurar DMARC (TXT Record)

**No DNS:**

- **Tipo:** TXT
- **Nome/Host:** `_dmarc`
- **Valor (inicial - permissivo):**
  ```
  v=DMARC1; p=none; rua=mailto:suporte@brasilpsd.com.br; ruf=mailto:suporte@brasilpsd.com.br
  ```

**Verificar:**
```bash
nslookup -type=TXT _dmarc.brasilpsd.com.br
```

## ⏰ Tempo de Propagação

- **Mínimo:** 1-2 horas
- **Máximo:** 48 horas
- **Recomendado:** Aguardar 4-6 horas antes de testar novamente

## 🧪 Como Testar Após Configurar

### 1. Verificar DNS

```bash
# SPF
nslookup -type=TXT brasilpsd.com.br

# DMARC
nslookup -type=TXT _dmarc.brasilpsd.com.br

# DKIM (substitua pelo nome correto)
nslookup -type=TXT default._domainkey.brasilpsd.com.br
```

### 2. Usar Mail-Tester

1. Acesse: https://www.mail-tester.com/
2. Envie um email de teste para o endereço fornecido
3. Verifique a pontuação (deve ser 10/10)
4. Veja se SPF, DKIM e DMARC estão passando

### 3. Verificar Google Postmaster Tools

1. Acesse: https://postmaster.google.com/
2. Adicione o domínio `brasilpsd.com.br`
3. Verifique se há problemas reportados
4. Veja estatísticas de entregabilidade

## ⚠️ Por Que Gmail é Diferente?

O Gmail:
- ✅ **Verifica SPF/DKIM/DMARC rigorosamente**
- ✅ **Bloqueia silenciosamente** se não passar
- ✅ **Não envia para spam** - simplesmente **não entrega**
- ✅ **Exige boa reputação** do domínio/IP

Outros provedores (Outlook, etc.):
- ⚠️ São mais permissivos
- ⚠️ Podem aceitar emails sem autenticação completa
- ⚠️ Podem enviar para spam em vez de bloquear

## 🔍 Verificar Reputação

### 1. Verificar Blacklists

Acesse: https://mxtoolbox.com/blacklists.aspx

Digite o IP do servidor SMTP da Hostinger e verifique se está em alguma blacklist.

### 2. Verificar Reputação do Domínio

- **Google Postmaster Tools:** https://postmaster.google.com/
- **MXToolbox Reputation:** https://mxtoolbox.com/Reputation.aspx

## 📝 Checklist Final

- [ ] SPF configurado e propagado
- [ ] DKIM configurado e propagado
- [ ] DMARC configurado e propagado
- [ ] Aguardou 4-6 horas após configurar
- [ ] Testou com Mail-Tester (pontuação 10/10)
- [ ] Verificou Google Postmaster Tools
- [ ] Verificou se IP não está em blacklist
- [ ] Testou enviando email para Gmail

## 🆘 Se Ainda Não Funcionar

1. **Verificar logs do Vercel:**
   - Veja se o email foi aceito pelo servidor SMTP
   - Verifique se há erros de autenticação

2. **Contatar Hostinger:**
   - Verifique se o DKIM está ativo
   - Peça verificação de reputação do IP
   - Confirme se há problemas conhecidos

3. **Verificar Google Postmaster Tools:**
   - Veja se há problemas reportados
   - Verifique estatísticas de entregabilidade
   - Veja se há bloqueios

4. **Considerar Serviço de Email Transacional:**
   - SendGrid
   - Mailgun
   - Amazon SES
   - Resend

## ✅ Código Já Otimizado

O código já está otimizado para Gmail:
- ✅ Versão texto + HTML
- ✅ Headers simplificados
- ✅ Message-ID válido
- ✅ Encoding UTF-8 correto

**O problema não é o código, é a configuração DNS!**

Configure SPF, DKIM e DMARC e aguarde a propagação. Após isso, os emails devem começar a chegar no Gmail.


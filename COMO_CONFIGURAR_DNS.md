# 🔧 Como Configurar DNS para Gmail Receber Emails

## ✅ Diagnóstico Confirmado

O DNS **não está configurado**. Por isso o Gmail não recebe os emails.

## 📋 Passo a Passo Completo

### 1. Configurar SPF (TXT Record)

**Onde configurar:** No painel DNS do seu provedor de domínio (onde você registrou `brasilpsd.com.br`)

**Configuração:**
- **Tipo:** TXT
- **Nome/Host:** `@` (ou deixe em branco, ou `brasilpsd.com.br`)
- **Valor/Conteúdo:** `v=spf1 include:_spf.hostinger.com ~all`
- **TTL:** 3600 (ou padrão)

**Exemplo visual:**
```
Tipo: TXT
Nome: @
Valor: v=spf1 include:_spf.hostinger.com ~all
TTL: 3600
```

### 2. Configurar DKIM

#### Passo 2.1: Obter DKIM da Hostinger

1. Acesse o painel da Hostinger
2. Vá em **Emails** > **Configurações** > **Custom DKIM**
3. Se não estiver ativo, **ative o DKIM**
4. Copie:
   - O **nome do registro** (ex: `default._domainkey` ou `hostinger._domainkey`)
   - O **valor completo** do registro DKIM

#### Passo 2.2: Adicionar no DNS

**No painel DNS do seu provedor de domínio:**

- **Tipo:** TXT
- **Nome/Host:** (o nome fornecido pela Hostinger, ex: `default._domainkey`)
- **Valor/Conteúdo:** (o valor completo fornecido pela Hostinger)
- **TTL:** 3600 (ou padrão)

**Exemplo visual:**
```
Tipo: TXT
Nome: default._domainkey
Valor: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
TTL: 3600
```

### 3. Configurar DMARC (TXT Record)

**No painel DNS do seu provedor de domínio:**

- **Tipo:** TXT
- **Nome/Host:** `_dmarc`
- **Valor/Conteúdo:** `v=DMARC1; p=none; rua=mailto:suporte@brasilpsd.com.br; ruf=mailto:suporte@brasilpsd.com.br`
- **TTL:** 3600 (ou padrão)

**Exemplo visual:**
```
Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=none; rua=mailto:suporte@brasilpsd.com.br; ruf=mailto:suporte@brasilpsd.com.br
TTL: 3600
```

## 🎯 Resumo dos 3 Registros

| Tipo | Nome | Valor |
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
    "dkimConfigured": true
  }
}
```

### 3. Testar Envio

1. Envie um email de verificação para uma conta Gmail
2. Verifique se chegou (incluindo pasta de spam)
3. Se não chegou, aguarde mais algumas horas

## 🧪 Ferramentas de Verificação

### Online:

1. **MXToolbox SPF:**
   - https://mxtoolbox.com/spf.aspx
   - Digite: `brasilpsd.com.br`

2. **MXToolbox DMARC:**
   - https://mxtoolbox.com/dmarc.aspx
   - Digite: `brasilpsd.com.br`

3. **MXToolbox DKIM:**
   - https://mxtoolbox.com/dkim.aspx
   - Digite: `default._domainkey.brasilpsd.com.br` (ou o nome fornecido pela Hostinger)

4. **Mail-Tester:**
   - https://www.mail-tester.com/
   - Envie um email de teste
   - Verifique pontuação (deve ser 10/10)

### Via Terminal:

```bash
# SPF
nslookup -type=TXT brasilpsd.com.br

# DMARC
nslookup -type=TXT _dmarc.brasilpsd.com.br

# DKIM (substitua pelo nome correto)
nslookup -type=TXT default._domainkey.brasilpsd.com.br
```

## ⚠️ Problemas Comuns

### 1. "Nome não encontrado"

- Verifique se digitou o nome corretamente
- Para SPF, use `@` ou deixe em branco
- Para DMARC, use exatamente `_dmarc`
- Para DKIM, use o nome exato fornecido pela Hostinger

### 2. "Valor muito longo"

- Alguns provedores DNS têm limite de caracteres
- Se o DKIM for muito longo, pode precisar dividir em múltiplos registros
- Consulte a documentação do seu provedor DNS

### 3. "Ainda não funciona após configurar"

- Aguarde mais tempo (até 48 horas)
- Verifique se os registros estão corretos
- Use ferramentas online para verificar propagação
- Verifique se não há erros de digitação

## 📝 Checklist

- [ ] SPF configurado (TXT @ com valor SPF)
- [ ] DKIM obtido da Hostinger
- [ ] DKIM configurado no DNS (TXT com nome da Hostinger)
- [ ] DMARC configurado (TXT _dmarc)
- [ ] Aguardou 4-6 horas
- [ ] Verificou com `/api/auth/check-dns`
- [ ] Testou com Mail-Tester
- [ ] Enviou email de teste para Gmail

## 🆘 Precisa de Ajuda?

Se tiver dúvidas sobre onde configurar:

1. **Identifique seu provedor de DNS:**
   - Onde você registrou o domínio `brasilpsd.com.br`?
   - Pode ser: Hostinger, Registro.br, GoDaddy, Namecheap, etc.

2. **Acesse o painel de DNS:**
   - Procure por "DNS", "Zona DNS", "Gerenciar DNS"
   - Adicione os registros TXT conforme acima

3. **Se o domínio está na Hostinger:**
   - Acesse: Painel Hostinger > Domínios > brasilpsd.com.br > DNS
   - Adicione os registros TXT

## ✅ Após Configurar Tudo

1. Aguarde 4-6 horas
2. Verifique com `/api/auth/check-dns`
3. Teste enviando email para Gmail
4. Se funcionar, os emails devem começar a chegar normalmente!

**O problema é 100% DNS. Configure e aguarde a propagação!**


# ✅ Adicionar DKIM na Vercel - Valores Exatos

## 📋 Informações do DKIM

Você já obteve os valores da Hostinger:

- **Host:** `hostingermail1._domainkey`
- **Value:** `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyD0rZohNI3m70uJrGg37iD2taYJQP4jbvH/w1okiByGDK4S/efqBqhT35lk68Zu+HY9vbH5THWR5p5m3W21JhyRo227lg4GtGCOO8+KKkzfHMZ78e3sEYe8eoRCCQwXAvz99RzJJ7GIr2moCx0OTovwnMNrO8HbWqlovYV75uP7vJs5XUxAoHrhNErYd/t9fPPuT4J6HPU0YTDKrwFkfQUUJNuI27UE+4UUl/GGHxTll8abuX3kvxJ97KTD2PUflBFlfoyrgxhBdS1GNyn+XDndQixdQTeWSYdh3/YVdGpUUnUMsBkvVfDEHfbAiqGYuap6BqqMJ0SrdsjaVAXuvBwIDAQAB`

## 🎯 Passo a Passo na Vercel

### 1. Acessar DNS na Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **Domains**
4. Clique no domínio `brasilpsd.com.br`
5. Vá na aba **DNS Records** ou **DNS**

### 2. Adicionar Registro DKIM

1. Clique em **Add Record** ou **Add DNS Record**

2. Configure exatamente assim:
   - **Type:** `TXT`
   - **Name:** `hostingermail1._domainkey`
   - **Value:** `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyD0rZohNI3m70uJrGg37iD2taYJQP4jbvH/w1okiByGDK4S/efqBqhT35lk68Zu+HY9vbH5THWR5p5m3W21JhyRo227lg4GtGCOO8+KKkzfHMZ78e3sEYe8eoRCCQwXAvz99RzJJ7GIr2moCx0OTovwnMNrO8HbWqlovYV75uP7vJs5XUxAoHrhNErYd/t9fPPuT4J6HPU0YTDKrwFkfQUUJNuI27UE+4UUl/GGHxTll8abuX3kvxJ97KTD2PUflBFlfoyrgxhBdS1GNyn+XDndQixdQTeWSYdh3/YVdGpUUnUMsBkvVfDEHfbAiqGYuap6BqqMJ0SrdsjaVAXuvBwIDAQAB`
   - **TTL:** 3600 (ou Auto)

3. **Salve o registro**

## ⚠️ Importante

- ✅ Copie o **valor completo** (é uma string longa)
- ✅ Use o nome exato: `hostingermail1._domainkey`
- ✅ Tipo deve ser `TXT`
- ✅ Não adicione espaços extras ou quebras de linha

## ⏰ Após Adicionar

### 1. Aguardar Propagação

- **Mínimo:** 1-2 horas
- **Recomendado:** 2-4 horas
- **Máximo:** 48 horas

### 2. Verificar

Após aguardar, acesse:
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

### 3. Verificar Manualmente

Você também pode verificar via terminal:
```bash
nslookup -type=TXT hostingermail1._domainkey.brasilpsd.com.br
```

Ou use ferramentas online:
- **MXToolbox DKIM:** https://mxtoolbox.com/dkim.aspx
- Digite: `hostingermail1._domainkey.brasilpsd.com.br`

## ✅ Checklist

- [ ] Adicionou registro TXT na Vercel
- [ ] Nome: `hostingermail1._domainkey`
- [ ] Valor: (string completa do DKIM)
- [ ] Tipo: TXT
- [ ] Aguardou 2-4 horas
- [ ] Verificou com `/api/auth/check-dns`
- [ ] `dkimConfigured: true`
- [ ] `allConfigured: true`

## 🎯 Próximos Passos

Após verificar que `allConfigured: true`:

1. ✅ Teste com Mail-Tester: https://www.mail-tester.com/
   - Deve dar 10/10
   - SPF, DKIM e DMARC devem estar passando

2. ✅ Teste real:
   - Envie um email de verificação para Gmail
   - Verifique se chegou (incluindo pasta de spam)

**Adicione o registro na Vercel e aguarde a propagação! 🚀**


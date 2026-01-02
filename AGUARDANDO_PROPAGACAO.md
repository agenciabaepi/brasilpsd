# ⏰ Aguardando Propagação do DKIM

## ✅ Status Atual

Você já configurou:
- ✅ **SPF:** Configurado e funcionando
- ✅ **DMARC:** Configurado e funcionando
- ✅ **DKIM:** Configurado (aguardando propagação)

## ⏰ Timeline de Propagação

- **0-1 hora:** DNS ainda propagando (pode não aparecer ainda)
- **1-2 horas:** DNS começando a propagar (pode aparecer intermitentemente)
- **2-4 horas:** DNS deve estar propagado (recomendado testar)
- **4-48 horas:** DNS totalmente propagado em todos os servidores

## 🔍 Como Verificar Quando Estiver Pronto

### Opção 1: Verificar via API (Recomendado)

Acesse periodicamente:
```
https://www.brasilpsd.com.br/api/auth/check-dns
```

Quando estiver pronto, deve retornar:
```json
{
  "summary": {
    "allConfigured": true,
    "spfConfigured": true,
    "dmarcConfigured": true,
    "dkimConfigured": true  ← Deve mudar para true
  }
}
```

### Opção 2: Verificar via MXToolbox

1. Acesse: https://mxtoolbox.com/dkim.aspx
2. Digite: `default._domainkey.brasilpsd.com.br` (ou o nome que você usou)
3. Clique em "DKIM Lookup"
4. Deve mostrar o registro DKIM quando estiver propagado

### Opção 3: Verificar via Terminal

```bash
nslookup -type=TXT default._domainkey.brasilpsd.com.br
```

(Substitua `default._domainkey` pelo nome que você usou)

## 🧪 Testar Quando Estiver Pronto

### 1. Verificar DNS Completo

Acesse `/api/auth/check-dns` e confirme que `allConfigured: true`

### 2. Testar com Mail-Tester

1. Acesse: https://www.mail-tester.com/
2. Copie o endereço de email fornecido
3. Envie um email de verificação para esse endereço
4. Volte ao Mail-Tester e verifique:
   - **Pontuação:** Deve ser 10/10
   - **SPF:** ✅ Passando
   - **DKIM:** ✅ Passando (deve aparecer agora!)
   - **DMARC:** ✅ Passando

### 3. Testar Envio Real para Gmail

1. Acesse: https://www.brasilpsd.com.br/signup
2. Tente criar uma conta com um email Gmail
3. Verifique se o código de verificação chegou
4. Verifique também a pasta de spam

## ⏰ Quando Testar

**Recomendado:** Aguarde pelo menos **2-4 horas** antes de testar

**Se não funcionar após 4 horas:**
- Verifique se o DKIM está configurado corretamente na Vercel
- Verifique se o nome e valor estão corretos
- Aguarde mais algumas horas (pode levar até 48 horas)

## ✅ Checklist Final

Quando `/api/auth/check-dns` mostrar `allConfigured: true`:

- [ ] Verificou que `dkimConfigured: true`
- [ ] Testou com Mail-Tester (pontuação 10/10)
- [ ] SPF, DKIM e DMARC todos passando no Mail-Tester
- [ ] Enviou email de teste para Gmail
- [ ] Email chegou no Gmail (incluindo pasta de spam)

## 🎯 O Que Esperar

Após a propagação completa:

✅ **DNS:** Todos os 3 registros (SPF, DKIM, DMARC) configurados  
✅ **Mail-Tester:** Pontuação 10/10  
✅ **Gmail:** Emails chegando normalmente  
✅ **Outlook:** Continua funcionando (já estava funcionando)  

## 🆘 Se Após 4-6 Horas Ainda Não Funcionar

1. **Verifique se DKIM está correto na Vercel:**
   - Nome está correto?
   - Valor está completo?
   - Tipo é TXT?

2. **Verifique se DKIM está ativo na Hostinger:**
   - Volte ao painel da Hostinger
   - Confirme que DKIM está ativo
   - Se não estiver, ative e aguarde

3. **Use ferramentas de verificação:**
   - MXToolbox DKIM: https://mxtoolbox.com/dkim.aspx
   - Verifique se o registro aparece

4. **Aguarde mais tempo:**
   - Às vezes pode levar até 48 horas
   - Propagação DNS varia por região

## 📊 Monitoramento

Você pode verificar periodicamente:

- **A cada 1 hora:** Verifique `/api/auth/check-dns`
- **Após 2 horas:** Teste com Mail-Tester
- **Após 4 horas:** Teste envio real para Gmail

**Aguarde a propagação e teste! Tudo deve funcionar quando o DKIM estiver propagado! 🚀**


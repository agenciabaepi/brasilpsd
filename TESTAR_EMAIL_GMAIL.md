# 🧪 Como Testar se Email Está Chegando no Gmail

## ✅ Após Configurar DNS

Após configurar SPF, DKIM e DMARC e aguardar a propagação (4-6 horas), siga estes passos para testar:

## 1. Verificar DNS Está Configurado

Acesse:
```
https://www.brasilpsd.com.br/api/auth/check-dns
```

Deve retornar:
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

Se ainda mostrar `false`, aguarde mais algumas horas.

## 2. Testar com Mail-Tester

1. Acesse: https://www.mail-tester.com/
2. Copie o endereço de email fornecido (ex: `test-xxxxx@mail-tester.com`)
3. No seu sistema, envie um email de verificação para esse endereço
4. Volte ao Mail-Tester e clique em "Then check your score"
5. Verifique:
   - **Pontuação:** Deve ser 10/10
   - **SPF:** Deve estar verde ✅
   - **DKIM:** Deve estar verde ✅
   - **DMARC:** Deve estar verde ✅

## 3. Testar Envio Real para Gmail

1. Acesse: https://www.brasilpsd.com.br/signup
2. Tente criar uma conta com um email Gmail
3. Verifique se o código de verificação chegou
4. Verifique também a pasta de spam

## 4. Verificar Logs do Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Deployments** > Selecione o último deploy
4. Clique em **Functions** > Procure por `/api/auth/send-verification-code`
5. Verifique os logs:
   - ✅ Deve mostrar "Email enviado com sucesso"
   - ✅ Deve mostrar "accepted: ['email@gmail.com']"
   - ❌ Se mostrar "rejected", há um problema

## 5. Verificar Google Postmaster Tools (Opcional)

1. Acesse: https://postmaster.google.com/
2. Adicione o domínio `brasilpsd.com.br`
3. Verifique se há problemas reportados
4. Veja estatísticas de entregabilidade

## ⏰ Timeline Esperada

- **0-2 horas:** DNS ainda propagando
- **2-4 horas:** DNS começando a propagar
- **4-6 horas:** DNS deve estar propagado (recomendado testar)
- **6-48 horas:** DNS totalmente propagado

## ✅ Checklist de Teste

- [ ] Aguardou 4-6 horas após configurar DNS
- [ ] Verificou com `/api/auth/check-dns` (deve mostrar `allConfigured: true`)
- [ ] Testou com Mail-Tester (pontuação 10/10)
- [ ] Enviou email de teste para Gmail
- [ ] Verificou pasta de spam do Gmail
- [ ] Verificou logs do Vercel
- [ ] (Opcional) Configurou Google Postmaster Tools

## 🆘 Se Ainda Não Funcionar

### 1. Verificar DNS Novamente

Use ferramentas online:
- **MXToolbox SPF:** https://mxtoolbox.com/spf.aspx
- **MXToolbox DMARC:** https://mxtoolbox.com/dmarc.aspx
- **MXToolbox DKIM:** https://mxtoolbox.com/dkim.aspx

### 2. Verificar se Registros Estão Corretos

Na Vercel, verifique se os 3 registros TXT estão:
- ✅ Nome correto
- ✅ Valor correto (sem erros de digitação)
- ✅ Tipo TXT

### 3. Aguardar Mais Tempo

Às vezes pode levar até 48 horas para propagação completa.

### 4. Verificar Blacklists

Acesse: https://mxtoolbox.com/blacklists.aspx
- Digite o IP do servidor SMTP da Hostinger
- Verifique se está em alguma blacklist

### 5. Contatar Hostinger

- Verifique se o DKIM está realmente ativo
- Peça verificação de reputação do IP
- Confirme se há problemas conhecidos

## 📊 Resultado Esperado

Após configurar tudo corretamente e aguardar propagação:

✅ **Mail-Tester:** 10/10  
✅ **SPF:** Passando  
✅ **DKIM:** Passando  
✅ **DMARC:** Passando  
✅ **Gmail:** Emails chegando normalmente  

**Aguarde a propagação e teste! Se tudo estiver configurado corretamente, deve funcionar!**


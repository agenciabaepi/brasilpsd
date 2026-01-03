# 📧 Sistema de Emails Automáticos

Este documento descreve todos os emails automáticos configurados no BrasilPSD.

## ✅ Emails Implementados

### 1. Email de Boas-Vindas
**Quando:** Após o usuário ativar a conta (verificar código de email)

**Onde:** `app/api/auth/send-welcome-email/route.ts`

**Template:** `lib/email/templates.ts` - `getWelcomeEmailTemplate()`

**Conteúdo:**
- Mensagem de boas-vindas personalizada
- Lista de funcionalidades disponíveis
- Links para explorar recursos, dashboard e se tornar criador

---

### 2. Email de Criador Aprovado
**Quando:** Quando um admin aprova a solicitação de um usuário para se tornar criador

**Onde:** `app/api/admin/creator-applications/[id]/approve/route.ts`

**Template:** `lib/email/templates.ts` - `getCreatorApprovedTemplate()`

**Conteúdo:**
- Parabéns pela aprovação
- Informações sobre o que pode fazer como criador
- Links para enviar recursos e acessar painel de criador

---

### 3. Email de Recurso Aprovado
**Quando:** Quando um admin aprova um recurso enviado por um criador

**Onde:** `app/api/admin/notify-resource/route.ts`

**Template:** `lib/email/templates.ts` - `getResourceApprovedTemplate()`

**Conteúdo:**
- Notificação de aprovação
- Título do recurso aprovado
- Link para visualizar o recurso publicado

---

### 4. Email de Recurso Rejeitado
**Quando:** Quando um admin rejeita um recurso enviado por um criador

**Onde:** `app/api/admin/notify-resource/route.ts`

**Template:** `lib/email/templates.ts` - `getResourceRejectedTemplate()`

**Conteúdo:**
- Notificação de rejeição
- Motivo da rejeição (se fornecido)
- Link para enviar novo recurso

---

### 5. Email de Confirmação de Assinatura
**Quando:** Quando uma nova assinatura é criada e confirmada

**Onde:** Já implementado em `lib/email/sender.ts` - `sendSubscriptionConfirmationEmail()`

**Template:** `lib/email/templates.ts` - `getSubscriptionConfirmationTemplate()`

**Conteúdo:**
- Confirmação da assinatura
- Detalhes do plano (nome, valor, ciclo de cobrança)
- Link para acessar dashboard

**Nota:** Este email precisa ser integrado no webhook do Asaas quando o pagamento for confirmado.

---

### 6. Email de Aviso de Assinatura Expirando
**Quando:** 1 dia antes da assinatura expirar

**Onde:** `app/api/cron/check-subscriptions-expiring/route.ts`

**Template:** `lib/email/templates.ts` - `getSubscriptionExpiringTemplate()`

**Conteúdo:**
- Aviso de que a assinatura expira em 1 dia
- Detalhes da assinatura (plano, data de expiração)
- Link para renovar assinatura
- Aviso sobre perda de acesso aos recursos premium

**Cron Job:** Configurado para executar diariamente às 9h (horário UTC)

---

## 🔧 Configuração

### Variáveis de Ambiente Necessárias

```env
# SMTP (já configurado)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=seu-email@brasilpsd.com.br
SMTP_PASSWORD=sua-senha

# Para cron job (opcional, mas recomendado)
CRON_SECRET=seu-secret-aleatorio-aqui
```

### Configuração do Cron Job no Vercel

O cron job está configurado no arquivo `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-subscriptions-expiring",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Horário:** 9h UTC (6h horário de Brasília)

**Frequência:** Diariamente

### Testando o Cron Job Manualmente

Para testar manualmente (como admin):

```bash
# Fazer requisição GET para a rota
curl https://seu-dominio.com/api/cron/check-subscriptions-expiring
```

Ou acessar diretamente no navegador (precisa estar logado como admin).

---

## 📝 Próximos Passos

### Integrar Email de Confirmação de Assinatura

O email de confirmação de assinatura já está implementado, mas precisa ser integrado no webhook do Asaas quando o pagamento for confirmado.

**Onde integrar:**
- Quando criar webhook do Asaas para confirmação de pagamento
- Chamar `sendSubscriptionConfirmationEmail()` após confirmar pagamento

**Exemplo:**
```typescript
import { sendSubscriptionConfirmationEmail } from '@/lib/email/sender'

// Após confirmar pagamento e criar/atualizar assinatura
await sendSubscriptionConfirmationEmail(
  userEmail,
  userName,
  planName,
  amount,
  billingCycle
)
```

---

## 🐛 Troubleshooting

### Emails não estão sendo enviados

1. **Verificar configuração SMTP:**
   - Verificar se todas as variáveis de ambiente estão configuradas
   - Testar conexão SMTP usando `/api/auth/test-smtp`

2. **Verificar logs:**
   - Verificar logs do Vercel para erros
   - Verificar logs do servidor SMTP (Hostinger)

3. **Verificar DNS:**
   - SPF, DKIM e DMARC devem estar configurados
   - Usar `/api/auth/check-dns` para verificar

### Cron Job não está executando

1. **Verificar configuração no Vercel:**
   - Verificar se `vercel.json` está correto
   - Verificar se o cron está ativo no dashboard da Vercel

2. **Verificar logs:**
   - Verificar logs do Vercel para erros de execução
   - Verificar se a rota está acessível

3. **Testar manualmente:**
   - Acessar a rota manualmente como admin
   - Verificar se retorna sucesso

---

## 📚 Arquivos Relacionados

- `lib/email/templates.ts` - Todos os templates de email
- `lib/email/sender.ts` - Funções de envio de email
- `lib/email/config.ts` - Configuração do SMTP
- `app/api/auth/send-welcome-email/route.ts` - Rota de email de boas-vindas
- `app/api/admin/send-creator-approved-email/route.ts` - Rota de email de criador aprovado
- `app/api/admin/notify-resource/route.ts` - Rota de notificação de recursos
- `app/api/cron/check-subscriptions-expiring/route.ts` - Cron job de assinaturas expirando
- `vercel.json` - Configuração do cron job

---

## ✨ Melhorias Futuras

- [ ] Adicionar email de confirmação de pagamento
- [ ] Adicionar email de renovação automática de assinatura
- [ ] Adicionar email de cancelamento de assinatura
- [ ] Adicionar email de recuperação de senha
- [ ] Adicionar email de mudança de senha
- [ ] Adicionar email de notificação de novos recursos favoritos
- [ ] Adicionar email de notificação de novos recursos de criadores seguidos


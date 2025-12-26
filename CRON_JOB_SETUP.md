# Configuração do Cron Job para Verificação de Assinaturas Expiradas

## ✅ Sistema Implementado

O sistema agora verifica automaticamente assinaturas expiradas de duas formas:

### 1. **Cron Job Automático (Diário)**
- **Endpoint**: `/api/cron/check-expired-subscriptions`
- **Frequência**: Diariamente à meia-noite (00:00 UTC)
- **Ação**: Verifica todas as assinaturas vencidas e bloqueia usuários automaticamente

### 2. **Verificação em Tempo Real**
- **Local**: API de Download (`/api/download`)
- **Ação**: Quando um usuário tenta baixar, verifica se a assinatura expirou e bloqueia imediatamente

## 🔧 Configuração no Vercel

### Passo 1: Adicionar Variável de Ambiente

1. Acesse o dashboard do Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione a variável:
   - **Nome**: `CRON_SECRET_TOKEN`
   - **Valor**: Gere um token seguro (ex: `openssl rand -hex 32`)
   - **Ambiente**: Production, Preview, Development

### Passo 2: Configurar o Cron Job no Vercel

O cron job já está configurado no `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expired-subscriptions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Nota**: O Vercel automaticamente adiciona o header `Authorization: Bearer {CRON_SECRET_TOKEN}` nas requisições do cron job.

### Passo 3: Verificar se está Funcionando

Após o deploy, você pode verificar os logs do cron job no dashboard do Vercel:
- **Deployments** → Selecione o deployment → **Functions** → Procure por `check-expired-subscriptions`

## 📋 O que o Sistema Faz

Quando uma assinatura expira:

1. **Remove Premium**: Define `is_premium = false` e `subscription_tier = null` no perfil do usuário
2. **Marca Assinatura**: Atualiza o status da assinatura para `expired` ou `suspended`
3. **Renovação Automática**: Se `auto_renew = true`, gera nova cobrança no Asaas
4. **Bloqueio Imediato**: Usuário não consegue mais baixar recursos premium

## 🔍 Verificação Manual

Você também pode chamar o endpoint manualmente (requer autenticação de admin):

```bash
GET /api/admin/subscriptions/check-expired
Authorization: Bearer {seu-token-jwt}
```

## ⚠️ Importante

- O cron job roda **diariamente à meia-noite UTC**
- Usuários são bloqueados **automaticamente** quando a assinatura expira
- A verificação em tempo real garante que mesmo sem o cron, usuários expirados são bloqueados ao tentar baixar
- Assinaturas com `auto_renew = true` geram nova cobrança automaticamente

## 🧪 Testar Localmente

Para testar o cron job localmente:

```bash
# Gerar um token de teste
export CRON_SECRET_TOKEN="test-secret-token"

# Chamar o endpoint
curl -X GET http://localhost:3000/api/cron/check-expired-subscriptions \
  -H "Authorization: Bearer test-secret-token"
```


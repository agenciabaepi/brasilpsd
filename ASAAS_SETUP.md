# Configuração Asaas - BrasilPSD

Guia completo para configurar a integração de pagamentos com Asaas.

## 📋 Pré-requisitos

- Conta no [Asaas](https://www.asaas.com/)
- Ambiente de produção ou sandbox configurado

## 🚀 Configuração

### 1. Criar Conta no Asaas

1. Acesse [https://www.asaas.com/](https://www.asaas.com/)
2. Crie sua conta (pode usar sandbox para testes)
3. Complete o cadastro da empresa

### 2. Obter API Key

1. No painel do Asaas, vá em **Integrações > API**
2. Gere uma nova API Key
3. Copie a chave (ela só será exibida uma vez!)

### 3. Configurar Webhook

1. No painel do Asaas, vá em **Integrações > Webhooks**
2. Clique em **Adicionar Webhook**
3. Configure:
   - **URL**: `https://seu-dominio.com/api/finance/webhook`
   - **Eventos**: Selecione todos os eventos de pagamento e assinatura:
     - `PAYMENT_RECEIVED`
     - `PAYMENT_CONFIRMED`
     - `PAYMENT_OVERDUE`
     - `PAYMENT_DELETED`
     - `SUBSCRIPTION_CREATED`
     - `SUBSCRIPTION_UPDATED`
     - `SUBSCRIPTION_DELETED`
4. Salve o webhook

### 4. Variáveis de Ambiente

Adicione ao seu `.env.local`:

```env
# Asaas
ASAAS_API_KEY=sua_api_key_aqui
ASAAS_API_URL=https://api.asaas.com/v3
# Para sandbox use: https://sandbox.asaas.com/api/v3
```

**Importante:**
- Use `https://sandbox.asaas.com/api/v3` para testes
- Use `https://api.asaas.com/v3` para produção
- Mantenha a API Key em segredo!

## ✅ Funcionalidades Implementadas

### Métodos de Pagamento Suportados

- ✅ **Cartão de Crédito** - Aprovação imediata
- ✅ **PIX** - Aprovação imediata após pagamento
- ✅ **Boleto** - Aprovação em até 3 dias úteis

### Planos de Assinatura

- **Premium Lite**: R$ 19,90/mês ou R$ 16,90/mês (anual)
- **Premium Pro**: R$ 29,90/mês ou R$ 24,90/mês (anual)
- **Premium Plus**: R$ 49,90/mês ou R$ 39,90/mês (anual)

### Eventos do Webhook

O sistema processa automaticamente:

- **PAYMENT_CONFIRMED**: Libera acesso premium automaticamente
- **PAYMENT_RECEIVED**: Atualiza status da transação
- **PAYMENT_OVERDUE**: Marca pagamento como em atraso
- **PAYMENT_DELETED**: Cancela transação
- **SUBSCRIPTION_DELETED**: Remove acesso premium
- **SUBSCRIPTION_UPDATED**: Atualiza tier da assinatura

## 🔧 Testando a Integração

### 1. Teste com Cartão de Crédito

Use cartões de teste do Asaas:
- **Aprovado**: 5162 3063 1010 7660
- **Recusado**: 4000 0000 0000 0002

### 2. Teste com PIX

1. Gere um pagamento PIX
2. Copie o código
3. Use o app do banco para pagar (sandbox)
4. O webhook deve liberar o acesso automaticamente

### 3. Verificar Webhook

1. Acesse o painel do Asaas
2. Vá em **Integrações > Webhooks**
3. Verifique os logs de entrega
4. Se houver erros, verifique os logs do servidor

## 🐛 Troubleshooting

### Webhook não está sendo recebido

1. Verifique se a URL está correta e acessível
2. Verifique se o servidor está rodando
3. Verifique os logs do Asaas em **Integrações > Webhooks > Logs**
4. Verifique os logs do servidor

### Pagamento confirmado mas acesso não liberado

1. Verifique se o webhook está configurado corretamente
2. Verifique se o `asaas_customer_id` está salvo no perfil do usuário
3. Verifique os logs do webhook no servidor
4. Verifique se o evento `PAYMENT_CONFIRMED` está sendo processado

### Erro ao criar assinatura

1. Verifique se a API Key está correta
2. Verifique se está usando a URL correta (sandbox vs produção)
3. Verifique se o cliente foi criado no Asaas
4. Verifique os logs de erro no servidor

## 📚 Documentação Adicional

- [Documentação Oficial do Asaas](https://docs.asaas.com/)
- [API Reference](https://docs.asaas.com/reference)
- [Webhooks](https://docs.asaas.com/docs/webhooks)

## 🔒 Segurança

- ✅ API Key armazenada em variáveis de ambiente
- ✅ Webhook processa eventos de forma segura
- ✅ Validação de dados antes de processar
- ✅ Logs de todas as operações

## 📝 Próximos Passos

Após configurar:

1. Teste todos os métodos de pagamento
2. Configure notificações por email (opcional)
3. Configure relatórios financeiros
4. Monitore os webhooks regularmente


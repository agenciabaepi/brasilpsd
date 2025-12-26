# Configuração de Email - BrasilPSD

Este documento explica como o sistema de email está configurado e como configurar as variáveis de ambiente necessárias.

## 📧 Configuração SMTP (Hostinger)

O sistema usa o servidor SMTP da Hostinger para envio de emails:

- **Servidor SMTP**: `smtp.hostinger.com`
- **Porta**: `465`
- **Segurança**: SSL/TLS habilitado
- **Email**: `suporte@brasilpsd.com.br`

## ⚙️ Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env.local`:

```env
# SMTP (Email)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=suporte@brasilpsd.com.br
SMTP_PASSWORD=@Deusefiel7loja2025
```

**⚠️ IMPORTANTE**: 
- Em produção (Vercel), adicione essas variáveis nas configurações do projeto
- Nunca commite o arquivo `.env.local` no repositório
- Use variáveis de ambiente seguras no Vercel

## 📨 Emails Enviados

O sistema envia emails automaticamente nos seguintes eventos:

### 1. **Verificação de Email** (`sendVerificationCodeEmail`)
- **Quando**: Usuário solicita cadastro
- **Conteúdo**: Código de 6 dígitos para verificação
- **Expiração**: 15 minutos

### 2. **Confirmação de Assinatura** (`sendSubscriptionConfirmationEmail`)
- **Quando**: 
  - Assinatura criada via cartão de crédito (aprovado imediatamente)
  - Pagamento confirmado (PIX/Boleto) via webhook ou check-payment
- **Conteúdo**: Detalhes da assinatura (plano, valor, ciclo de cobrança)

### 3. **Confirmação de Pagamento** (`sendPaymentConfirmationEmail`)
- **Quando**: Pagamento confirmado/recebido
- **Conteúdo**: Detalhes do pagamento (valor, método, ID do pagamento)

### 4. **Recurso Aprovado** (`sendResourceApprovedEmail`)
- **Quando**: Admin aprova um recurso enviado por criador
- **Conteúdo**: Notificação de aprovação com link para o recurso

### 5. **Recurso Rejeitado** (`sendResourceRejectedEmail`)
- **Quando**: Admin rejeita um recurso
- **Conteúdo**: Notificação de rejeição com motivo (se fornecido)

## 🔧 Estrutura do Sistema

### Arquivos Principais

- `lib/email/config.ts`: Configuração do transportador SMTP
- `lib/email/templates.ts`: Templates HTML dos emails
- `lib/email/sender.ts`: Funções para enviar emails

### Integrações

Os emails são integrados nos seguintes pontos:

1. **Signup** (`app/api/auth/send-verification-code/route.ts`)
   - Envia código de verificação

2. **Checkout** (`app/api/finance/checkout/route.ts`)
   - Envia confirmação de assinatura para pagamentos com cartão

3. **Webhook Asaas** (`app/api/finance/webhook/route.ts`)
   - Envia confirmação de pagamento e assinatura quando pagamento é confirmado

4. **Check Payment** (`app/api/finance/check-payment/route.ts`)
   - Envia confirmação quando pagamento é verificado e confirmado

5. **Admin Dashboard** (`app/admin/page.tsx`)
   - Envia notificações quando recursos são aprovados/rejeitados

## 🎨 Templates

Os templates são criados em HTML com estilização inline para compatibilidade máxima entre clientes de email. Todos os templates incluem:

- **Logo do sistema**: Logo BrasilPSD exibido no cabeçalho do email
- **Design moderno**: Layout responsivo com gradientes e cores profissionais
- **Conteúdo formatado**: Tipografia otimizada e espaçamento adequado
- **Botões de ação**: Botões estilizados com gradientes (quando aplicável)
- **Footer informativo**: Links para o site e dashboard
- **Compatibilidade**: Suporte para Outlook (MSO) e clientes de email modernos

### Melhorias para Evitar Spam

Os templates foram otimizados para reduzir a chance de serem marcados como spam:

- ✅ HTML bem estruturado e semântico
- ✅ Meta tags apropriadas para clientes de email
- ✅ Imagens hospedadas (logo via URL pública)
- ✅ Texto alternativo para imagens
- ✅ Cores e design profissionais
- ✅ Links válidos e funcionais
- ✅ Estrutura responsiva para mobile

## 🧪 Testando

### Em Desenvolvimento

1. Configure as variáveis de ambiente no `.env.local`
2. Reinicie o servidor Next.js
3. Execute uma ação que dispara um email (ex: cadastro, checkout)
4. Verifique os logs do console para confirmação de envio
5. Verifique a caixa de entrada do destinatário

### Em Produção

1. Configure as variáveis de ambiente no Vercel
2. Faça deploy
3. Teste os fluxos que disparam emails
4. Monitore os logs do Vercel para erros

## 🐛 Troubleshooting

### Email não está sendo enviado

1. **Verifique as variáveis de ambiente**:
   ```bash
   echo $SMTP_HOST
   echo $SMTP_USER
   ```

2. **Verifique os logs**:
   - Console do servidor (desenvolvimento)
   - Logs do Vercel (produção)
   - Procure por mensagens de erro relacionadas a SMTP

3. **Teste conexão SMTP**:
   - Verifique se as credenciais estão corretas
   - Teste conectividade com o servidor SMTP da Hostinger

### Erro de autenticação SMTP

- Verifique se a senha está correta
- Certifique-se de que o email está ativo na Hostinger
- Verifique se a porta 465 está acessível

### Emails indo para spam / Mensagem de "não foi possível verificar"

A mensagem de "não foi possível verificar se este email veio do remetente" aparece porque o domínio não tem registros SPF, DKIM e DMARC configurados no DNS.

#### ✅ Melhorias já implementadas:
- ✅ **Templates melhorados**: Design profissional com logo e estrutura HTML otimizada
- ✅ **Logo em base64**: Logo agora é carregado como base64 para garantir compatibilidade
- ✅ **Código visível**: Código de verificação com cor sólida azul (#1e40af) e texto branco
- ✅ **Estilos inline**: CSS inline para máxima compatibilidade com clientes de email
- ✅ **Headers de autenticação**: Headers X-Mailer e List-Unsubscribe adicionados
- ✅ **Reply-to configurado**: Email de resposta configurado

#### ⚠️ Ação necessária para resolver o aviso de verificação:

**Configure SPF, DKIM e DMARC no DNS do domínio `brasilpsd.com.br`:**

1. **SPF Record** (TXT record):
   ```
   v=spf1 include:_spf.hostinger.com ~all
   ```
   Ou se usar apenas Hostinger:
   ```
   v=spf1 a mx include:smtp.hostinger.com ~all
   ```

2. **DKIM** (fornecido pela Hostinger):
   - Acesse o painel da Hostinger
   - Vá em Email > Configurações > DKIM
   - Copie o registro DKIM fornecido
   - Adicione como TXT record no DNS

3. **DMARC** (TXT record):
   ```
   v=DMARC1; p=quarantine; rua=mailto:suporte@brasilpsd.com.br; ruf=mailto:suporte@brasilpsd.com.br; fo=1
   ```
   Ou mais permissivo para começar:
   ```
   v=DMARC1; p=none; rua=mailto:suporte@brasilpsd.com.br
   ```

**Como adicionar no DNS:**
- Acesse o painel de DNS do seu provedor de domínio
- Adicione os registros TXT acima
- Aguarde propagação (pode levar até 48 horas)

**Nota sobre o logo**: O logo agora é carregado como base64 diretamente no HTML, garantindo que funcione mesmo se a URL pública não estiver acessível. O arquivo `/public/images/logopreto.png` é lido do sistema de arquivos e convertido para base64 automaticamente.

## 📝 Próximos Passos

- [ ] Configurar DNS records (SPF, DKIM) para melhorar entregabilidade
- [ ] Adicionar templates mais elaborados
- [ ] Implementar fila de emails para alta demanda
- [ ] Adicionar tracking de emails abertos/clicados
- [ ] Criar dashboard de logs de emails enviados


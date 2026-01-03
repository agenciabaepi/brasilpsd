/**
 * Templates de email HTML para o BrasilPSD
 */

import fs from 'fs'
import path from 'path'

// Função para obter a URL base do app
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.brasilpsd.com.br'
}

// Função para obter o logo em base64 (para garantir que funcione em todos os clientes de email)
function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logopreto.png')
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath)
      const base64 = logoBuffer.toString('base64')
      return `data:image/png;base64,${base64}`
    }
  } catch (error) {
    console.warn('Erro ao carregar logo, usando URL:', error)
  }
  // Fallback para URL se base64 não funcionar
  const appUrl = getAppUrl()
  return `${appUrl}/images/logopreto.png`
}

const baseHTML = (content: string, title: string) => {
  const logoUrl = getLogoBase64()
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      outline: none;
      text-decoration: none;
    }
    
    /* Main styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f7fa;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .email-wrapper {
      width: 100%;
      background-color: #f5f7fa;
      padding: 40px 20px;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    
    .email-header {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      padding: 40px 40px 30px;
      text-align: center;
      border-bottom: 1px solid #e9ecef;
    }
    
    .logo-container {
      margin-bottom: 20px;
    }
    
    .logo-img {
      max-width: 180px;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    
    .email-content {
      padding: 40px;
      color: #333333;
    }
    
    .email-content h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 20px 0;
      line-height: 1.3;
    }
    
    .email-content h2 {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 16px 0;
      line-height: 1.4;
    }
    
    .email-content p {
      font-size: 16px;
      line-height: 1.6;
      color: #4a5568;
      margin: 0 0 16px 0;
    }
    
    .code-container {
      background-color: #1e40af;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      text-align: center;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
    }
    
    .code-label {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    
    .code {
      font-size: 42px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 12px;
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .code-expiry {
      font-size: 14px;
      color: #e0e7ff;
      margin-top: 12px;
    }
    
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #1e40af;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      text-align: center;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
    }
    
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 16px 20px;
      margin: 24px 0;
      border-radius: 4px;
    }
    
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #6c757d;
    }
    
    .email-footer {
      background-color: #f8f9fa;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    
    .email-footer p {
      font-size: 13px;
      color: #6c757d;
      margin: 8px 0;
      line-height: 1.5;
    }
    
    .email-footer a {
      color: #667eea;
      text-decoration: none;
    }
    
    .divider {
      height: 1px;
      background-color: #e9ecef;
      margin: 24px 0;
      border: none;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      
      .email-header,
      .email-content,
      .email-footer {
        padding: 30px 20px !important;
      }
      
      .code {
        font-size: 32px !important;
        letter-spacing: 8px !important;
      }
      
      .email-content h1 {
        font-size: 22px !important;
      }
      
      .email-content h2 {
        font-size: 18px !important;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header" style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e9ecef;">
        <div class="logo-container" style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="BrasilPSD" class="logo-img" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" width="180" height="60" />
        </div>
      </div>
      <div class="email-content">
        ${content}
      </div>
      <div class="email-footer">
        <p><strong>Este é um email automático, por favor não responda.</strong></p>
        <hr class="divider" />
        <p>&copy; ${new Date().getFullYear()} BrasilPSD. Todos os direitos reservados.</p>
        <p>
          <a href="${getAppUrl()}">Visite nosso site</a> | 
          <a href="${getAppUrl()}/dashboard">Acessar Dashboard</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`
}

/**
 * Template de texto para código de verificação (Gmail prefere texto + HTML)
 */
export function getVerificationCodeTextTemplate(code: string, name?: string): string {
  const greeting = name ? `Olá, ${name}!` : 'Olá!'
  return `
${greeting}

Você solicitou verificar seu email no BrasilPSD. Use o código abaixo para completar a verificação:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓDIGO DE VERIFICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${code}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este código expira em 15 minutos.

Digite este código na página de verificação para confirmar seu endereço de email.

⚠️ IMPORTANTE: Se você não solicitou esta verificação, pode ignorar este email com segurança. Ninguém terá acesso à sua conta sem este código.

Atenciosamente,
Equipe BrasilPSD
  `.trim()
}

/**
 * Template para código de verificação de email
 */
export function getVerificationCodeTemplate(code: string, name?: string) {
  const greeting = name ? `Olá, ${name}!` : 'Olá!'
  const content = `
    <h1>${greeting}</h1>
    <p>Você solicitou verificar seu email no BrasilPSD. Use o código abaixo para completar a verificação:</p>
    
    <div class="code-container" style="background-color: #1e40af; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);">
      <div class="code-label" style="font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Código de Verificação</div>
      <div class="code" style="font-size: 42px; font-weight: 700; color: #ffffff; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace; margin: 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">${code}</div>
      <div class="code-expiry" style="font-size: 14px; color: #e0e7ff; margin-top: 12px;">Este código expira em 15 minutos</div>
    </div>
    
    <p>Digite este código na página de verificação para confirmar seu endereço de email.</p>
    
    <div class="info-box" style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #6c757d;"><strong>⚠️ Importante:</strong> Se você não solicitou esta verificação, pode ignorar este email com segurança. Ninguém terá acesso à sua conta sem este código.</p>
    </div>
  `
  return baseHTML(content, 'Verificação de Email - BrasilPSD')
}

/**
 * Template para confirmação de assinatura
 */
export function getSubscriptionConfirmationTemplate(
  userName: string,
  planName: string,
  amount: number,
  billingCycle: string
) {
  const cycleText = billingCycle === 'monthly' ? 'mensal' : 'anual'
  const appUrl = getAppUrl()
  const content = `
    <h1>Assinatura Confirmada! 🎉</h1>
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Sua assinatura do plano <strong>${planName}</strong> foi confirmada com sucesso!</p>
    
    <div class="info-box" style="background-color: #e8f5e9; border-left-color: #4caf50;">
      <p style="margin: 0;"><strong>📋 Detalhes da Assinatura:</strong></p>
      <p style="margin: 8px 0 0 0;"><strong>Plano:</strong> ${planName} (${cycleText})</p>
      <p style="margin: 4px 0 0 0;"><strong>Valor:</strong> R$ ${amount.toFixed(2).replace('.', ',')}</p>
    </div>
    
    <p>Agora você tem acesso completo a todos os recursos premium do BrasilPSD!</p>
    <p style="text-align: center;">
      <a href="${appUrl}/dashboard" class="button">Acessar Dashboard</a>
    </p>
  `
  return baseHTML(content, 'Assinatura Confirmada - BrasilPSD')
}

/**
 * Template para confirmação de pagamento
 */
export function getPaymentConfirmationTemplate(
  userName: string,
  amount: number,
  paymentMethod: string,
  paymentId: string
) {
  const methodText = paymentMethod === 'PIX' ? 'PIX' : paymentMethod === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'Boleto'
  const appUrl = getAppUrl()
  const content = `
    <h1>Pagamento Confirmado! ✅</h1>
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Seu pagamento foi confirmado com sucesso!</p>
    
    <div class="info-box" style="background-color: #e3f2fd; border-left-color: #2196f3;">
      <p style="margin: 0;"><strong>💳 Detalhes do Pagamento:</strong></p>
      <p style="margin: 8px 0 0 0;"><strong>Valor:</strong> R$ ${amount.toFixed(2).replace('.', ',')}</p>
      <p style="margin: 4px 0 0 0;"><strong>Método:</strong> ${methodText}</p>
      <p style="margin: 4px 0 0 0;"><strong>ID do Pagamento:</strong> ${paymentId}</p>
    </div>
    
    <p>Obrigado por escolher o BrasilPSD!</p>
    <p style="text-align: center;">
      <a href="${appUrl}/dashboard" class="button">Acessar Dashboard</a>
    </p>
  `
  return baseHTML(content, 'Pagamento Confirmado - BrasilPSD')
}

/**
 * Template para recurso aprovado
 */
export function getResourceApprovedTemplate(
  creatorName: string,
  resourceTitle: string,
  resourceUrl: string
) {
  const content = `
    <h1>Recurso Aprovado! 🎨</h1>
    <p>Olá, <strong>${creatorName}</strong>!</p>
    <p>Ótimas notícias! Seu recurso "<strong>${resourceTitle}</strong>" foi aprovado e já está disponível na plataforma!</p>
    
    <div class="info-box" style="background-color: #e8f5e9; border-left-color: #4caf50;">
      <p style="margin: 0;"><strong>✅ Status:</strong> Aprovado e publicado</p>
      <p style="margin: 8px 0 0 0;">Seu recurso já está visível para todos os usuários da plataforma.</p>
    </div>
    
    <p>Obrigado por contribuir com conteúdo de qualidade para a comunidade BrasilPSD.</p>
    <p style="text-align: center;">
      <a href="${resourceUrl}" class="button">Ver Recurso</a>
    </p>
  `
  return baseHTML(content, 'Recurso Aprovado - BrasilPSD')
}

/**
 * Template para recurso rejeitado
 */
export function getResourceRejectedTemplate(
  creatorName: string,
  resourceTitle: string,
  reason?: string
) {
  const appUrl = getAppUrl()
  const reasonSection = reason ? `
    <div class="info-box" style="background-color: #fff3e0; border-left-color: #ff9800;">
      <p style="margin: 0;"><strong>📝 Motivo da Rejeição:</strong></p>
      <p style="margin: 8px 0 0 0;">${reason}</p>
    </div>
  ` : ''
  const content = `
    <h1>Recurso Não Aprovado</h1>
    <p>Olá, <strong>${creatorName}</strong>!</p>
    <p>Infelizmente, seu recurso "<strong>${resourceTitle}</strong>" não foi aprovado.</p>
    ${reasonSection}
    <p>Você pode fazer ajustes e enviar novamente. Qualquer dúvida, entre em contato conosco através do suporte.</p>
    <p style="text-align: center;">
      <a href="${appUrl}/creator/upload" class="button">Enviar Novo Recurso</a>
    </p>
  `
  return baseHTML(content, 'Recurso Não Aprovado - BrasilPSD')
}

/**
 * Template de texto para email de boas-vindas
 */
export function getWelcomeEmailTextTemplate(userName: string): string {
  const appUrl = getAppUrl()
  return `
Bem-vindo ao BrasilPSD, ${userName}!

Sua conta foi criada com sucesso e está pronta para uso!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O QUE VOCÊ PODE FAZER AGORA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Explorar milhares de recursos profissionais
✅ Baixar recursos gratuitos
✅ Favoritar seus recursos preferidos
✅ Criar coleções personalizadas
✅ Acessar recursos premium com assinatura

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Comece explorando nossa biblioteca de recursos:
${appUrl}/explore

Acesse seu dashboard:
${appUrl}/dashboard

Seja um criador e compartilhe seus recursos:
${appUrl}/creator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Estamos felizes em tê-lo conosco! Se tiver alguma dúvida, nossa equipe está pronta para ajudar.

Atenciosamente,
Equipe BrasilPSD
  `.trim()
}

/**
 * Template para email de boas-vindas após ativar conta
 */
export function getWelcomeEmailTemplate(userName: string) {
  const appUrl = getAppUrl()
  const content = `
    <h1>Bem-vindo ao BrasilPSD! 🎉</h1>
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Sua conta foi criada com sucesso e está pronta para uso!</p>
    
    <div class="info-box" style="background-color: #e8f5e9; border-left-color: #4caf50;">
      <p style="margin: 0;"><strong>✨ O que você pode fazer agora:</strong></p>
      <p style="margin: 8px 0 0 0;">✅ Explorar milhares de recursos profissionais</p>
      <p style="margin: 4px 0 0 0;">✅ Baixar recursos gratuitos</p>
      <p style="margin: 4px 0 0 0;">✅ Favoritar seus recursos preferidos</p>
      <p style="margin: 4px 0 0 0;">✅ Criar coleções personalizadas</p>
      <p style="margin: 4px 0 0 0;">✅ Acessar recursos premium com assinatura</p>
    </div>
    
    <p>Estamos felizes em tê-lo conosco! Comece explorando nossa biblioteca de recursos.</p>
    <p style="text-align: center;">
      <a href="${appUrl}/explore" class="button">Explorar Recursos</a>
    </p>
    <p style="text-align: center; margin-top: 16px;">
      <a href="${appUrl}/dashboard" style="color: #667eea; text-decoration: none;">Acessar Dashboard</a> | 
      <a href="${appUrl}/creator" style="color: #667eea; text-decoration: none;">Seja um Criador</a>
    </p>
  `
  return baseHTML(content, 'Bem-vindo ao BrasilPSD')
}

/**
 * Template de texto para email quando criador é aprovado
 */
export function getCreatorApprovedTextTemplate(userName: string): string {
  const appUrl = getAppUrl()
  return `
Parabéns, ${userName}!

Sua solicitação para se tornar um criador foi APROVADA!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O QUE VOCÊ PODE FAZER AGORA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Enviar seus recursos para a plataforma
✅ Compartilhar seu trabalho com a comunidade
✅ Ganhar visibilidade para seus projetos
✅ Contribuir com conteúdo de qualidade

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Acesse seu painel de criador:
${appUrl}/creator

Envie seu primeiro recurso:
${appUrl}/creator/upload

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Estamos ansiosos para ver seus recursos na plataforma!

Atenciosamente,
Equipe BrasilPSD
  `.trim()
}

/**
 * Template para email quando criador é aprovado
 */
export function getCreatorApprovedTemplate(userName: string) {
  const appUrl = getAppUrl()
  const content = `
    <h1>Parabéns! Você é um Criador! 🎨</h1>
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Sua solicitação para se tornar um criador foi <strong>APROVADA</strong>!</p>
    
    <div class="info-box" style="background-color: #e8f5e9; border-left-color: #4caf50;">
      <p style="margin: 0;"><strong>✨ O que você pode fazer agora:</strong></p>
      <p style="margin: 8px 0 0 0;">✅ Enviar seus recursos para a plataforma</p>
      <p style="margin: 4px 0 0 0;">✅ Compartilhar seu trabalho com a comunidade</p>
      <p style="margin: 4px 0 0 0;">✅ Ganhar visibilidade para seus projetos</p>
      <p style="margin: 4px 0 0 0;">✅ Contribuir com conteúdo de qualidade</p>
    </div>
    
    <p>Estamos ansiosos para ver seus recursos na plataforma!</p>
    <p style="text-align: center;">
      <a href="${appUrl}/creator/upload" class="button">Enviar Primeiro Recurso</a>
    </p>
    <p style="text-align: center; margin-top: 16px;">
      <a href="${appUrl}/creator" style="color: #667eea; text-decoration: none;">Acessar Painel de Criador</a>
    </p>
  `
  return baseHTML(content, 'Criador Aprovado - BrasilPSD')
}

/**
 * Template de texto para aviso de assinatura expirando
 */
export function getSubscriptionExpiringTextTemplate(
  userName: string,
  planName: string,
  expirationDate: string
): string {
  const appUrl = getAppUrl()
  return `
Atenção, ${userName}!

Sua assinatura do plano ${planName} expira em 1 dia!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALHES DA ASSINATURA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plano: ${planName}
Data de Expiração: ${expirationDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para continuar aproveitando todos os recursos premium, renove sua assinatura antes que expire.

Renove agora:
${appUrl}/premium

Acesse seu dashboard:
${appUrl}/dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Não perca acesso aos recursos premium! Renove hoje.

Atenciosamente,
Equipe BrasilPSD
  `.trim()
}

/**
 * Template para aviso de assinatura expirando (1 dia antes)
 */
export function getSubscriptionExpiringTemplate(
  userName: string,
  planName: string,
  expirationDate: string
) {
  const appUrl = getAppUrl()
  const content = `
    <h1>Atenção! Sua Assinatura Expira Amanhã ⚠️</h1>
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Sua assinatura do plano <strong>${planName}</strong> expira em <strong>1 dia</strong>!</p>
    
    <div class="info-box" style="background-color: #fff3e0; border-left-color: #ff9800;">
      <p style="margin: 0;"><strong>📅 Detalhes da Assinatura:</strong></p>
      <p style="margin: 8px 0 0 0;"><strong>Plano:</strong> ${planName}</p>
      <p style="margin: 4px 0 0 0;"><strong>Data de Expiração:</strong> ${expirationDate}</p>
    </div>
    
    <p>Para continuar aproveitando todos os recursos premium, renove sua assinatura antes que expire.</p>
    <p style="text-align: center;">
      <a href="${appUrl}/premium" class="button">Renovar Assinatura</a>
    </p>
    <p style="text-align: center; margin-top: 16px;">
      <a href="${appUrl}/dashboard" style="color: #667eea; text-decoration: none;">Acessar Dashboard</a>
    </p>
    <p style="font-size: 14px; color: #6c757d; margin-top: 24px;">
      <strong>⚠️ Importante:</strong> Após a expiração, você perderá acesso aos recursos premium. Renove hoje para evitar interrupções!
    </p>
  `
  return baseHTML(content, 'Assinatura Expirando - BrasilPSD')
}


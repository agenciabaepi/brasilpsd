import { createEmailTransporter, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME } from './config'

// Função auxiliar para obter URL do app
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.brasilpsd.com.br'
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string // Versão texto (Gmail prefere texto + HTML)
  from?: string
  fromName?: string
}

/**
 * Envia um email usando o transportador SMTP configurado
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = createEmailTransporter()
  
  const from = options.from || DEFAULT_FROM_EMAIL
  const fromName = options.fromName || DEFAULT_FROM_NAME
  const fromAddress = fromName ? `${fromName} <${from}>` : from

  try {
    console.log('📧 Tentando enviar email:', {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
    })

    // Verificar conexão antes de enviar
    try {
      await transporter.verify()
      console.log('✅ Conexão SMTP verificada com sucesso')
    } catch (verifyError: any) {
      console.error('❌ Erro ao verificar conexão SMTP:', {
        error: verifyError.message,
        code: verifyError.code,
        command: verifyError.command,
        response: verifyError.response,
      })
      throw new Error(`Falha na conexão SMTP: ${verifyError.message}`)
    }

    // Se não tiver versão texto, criar do HTML (Gmail prefere emails com texto + HTML)
    const textVersion = options.text || options.html
      .replace(/<[^>]+>/g, '') // Remove tags HTML
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: textVersion, // Versão texto para Gmail (sempre incluir)
      html: options.html,
      // Headers otimizados para Gmail
      headers: {
        'X-Mailer': 'BrasilPSD',
        'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@brasilpsd.com.br>`,
        'X-Priority': '1',
        'Importance': 'normal',
        'Precedence': 'bulk',
        'Auto-Submitted': 'auto-generated',
      },
      // Reply-to para melhorar reputação
      replyTo: DEFAULT_FROM_EMAIL,
      // Prioridade normal
      priority: 'normal',
      // Encoding UTF-8
      encoding: 'UTF-8',
      // Lista de unsubscribe (Gmail verifica isso)
      list: {
        unsubscribe: `<${getAppUrl()}/unsubscribe>`,
      },
    })

    // Log detalhado da resposta
    const responseDetails = {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      envelope: info.envelope,
    }

    console.log('✅ Email enviado com sucesso:', responseDetails)

    // Verificar se o email foi realmente aceito
    if (info.rejected && info.rejected.length > 0) {
      console.error('⚠️ Email foi rejeitado pelo servidor:', {
        rejected: info.rejected,
        response: info.response,
      })
      throw new Error(`Email rejeitado pelo servidor: ${info.rejected.join(', ')}`)
    }

    // Verificar se foi aceito
    if (!info.accepted || info.accepted.length === 0) {
      console.error('⚠️ Email não foi aceito pelo servidor:', responseDetails)
      throw new Error('Email não foi aceito pelo servidor SMTP')
    }
  } catch (error: any) {
    console.error('❌ Erro ao enviar email:', {
      to: options.to,
      subject: options.subject,
      from: fromAddress,
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      port: error.port,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * Envia email de verificação de código
 */
export async function sendVerificationCodeEmail(email: string, code: string, name?: string): Promise<void> {
  const { getVerificationCodeTemplate, getVerificationCodeTextTemplate } = await import('./templates')
  
  // Gmail prefere emails com versão texto + HTML
  const textVersion = getVerificationCodeTextTemplate(code, name)
  const htmlVersion = getVerificationCodeTemplate(code, name)
  
  await sendEmail({
    to: email,
    subject: 'Código de Verificação - BrasilPSD',
    html: htmlVersion,
    text: textVersion, // Versão texto explícita para Gmail
  })
}

/**
 * Envia email de confirmação de assinatura
 */
export async function sendSubscriptionConfirmationEmail(
  email: string,
  userName: string,
  planName: string,
  amount: number,
  billingCycle: string
): Promise<void> {
  const { getSubscriptionConfirmationTemplate } = await import('./templates')
  
  await sendEmail({
    to: email,
    subject: 'Assinatura Confirmada - BrasilPSD',
    html: getSubscriptionConfirmationTemplate(userName, planName, amount, billingCycle),
  })
}

/**
 * Envia email de confirmação de pagamento
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  userName: string,
  amount: number,
  paymentMethod: string,
  paymentId: string
): Promise<void> {
  const { getPaymentConfirmationTemplate } = await import('./templates')
  
  await sendEmail({
    to: email,
    subject: 'Pagamento Confirmado - BrasilPSD',
    html: getPaymentConfirmationTemplate(userName, amount, paymentMethod, paymentId),
  })
}

/**
 * Envia email quando recurso é aprovado
 */
export async function sendResourceApprovedEmail(
  email: string,
  creatorName: string,
  resourceTitle: string,
  resourceId: string
): Promise<void> {
  const { getResourceApprovedTemplate } = await import('./templates')
  const resourceUrl = `https://www.brasilpsd.com.br/resources/${resourceId}`
  
  await sendEmail({
    to: email,
    subject: 'Seu recurso foi aprovado! - BrasilPSD',
    html: getResourceApprovedTemplate(creatorName, resourceTitle, resourceUrl),
  })
}

/**
 * Envia email quando recurso é rejeitado
 */
export async function sendResourceRejectedEmail(
  email: string,
  creatorName: string,
  resourceTitle: string,
  reason?: string
): Promise<void> {
  const { getResourceRejectedTemplate } = await import('./templates')
  
  await sendEmail({
    to: email,
    subject: 'Recurso não aprovado - BrasilPSD',
    html: getResourceRejectedTemplate(creatorName, resourceTitle, reason),
  })
}


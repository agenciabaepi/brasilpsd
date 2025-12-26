import { createEmailTransporter, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME } from './config'

// Função auxiliar para obter URL do app
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.brasilpsd.com.br'
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
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
    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      // Headers para melhorar autenticação e reduzir spam
      headers: {
        'X-Mailer': 'BrasilPSD',
        'X-Priority': '3',
        'List-Unsubscribe': `<${getAppUrl()}/unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      // Reply-to para melhorar reputação
      replyTo: DEFAULT_FROM_EMAIL,
    })

    console.log('✅ Email enviado com sucesso:', {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
    })
  } catch (error: any) {
    console.error('❌ Erro ao enviar email:', {
      to: options.to,
      subject: options.subject,
      error: error.message,
    })
    throw error
  }
}

/**
 * Envia email de verificação de código
 */
export async function sendVerificationCodeEmail(email: string, code: string, name?: string): Promise<void> {
  const { getVerificationCodeTemplate } = await import('./templates')
  
  await sendEmail({
    to: email,
    subject: 'Código de Verificação - BrasilPSD',
    html: getVerificationCodeTemplate(code, name),
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


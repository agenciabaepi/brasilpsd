import nodemailer from 'nodemailer'

/**
 * Configuração do servidor SMTP (Hostinger)
 * Baseado nas informações da imagem fornecida:
 * - Servidor SMTP: smtp.hostinger.com
 * - Porta: 465
 * - SSL/TLS: Habilitado
 */
export function createEmailTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '465')
  const smtpUser = process.env.SMTP_USER || 'suporte@brasilpsd.com.br'
  const smtpPassword = process.env.SMTP_PASSWORD || '@Deusefiel7loja2025'

  if (!smtpUser || !smtpPassword) {
    throw new Error('SMTP credentials não configuradas. Configure SMTP_USER e SMTP_PASSWORD nas variáveis de ambiente.')
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true, // true para porta 465, false para outras portas
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    tls: {
      // Não rejeitar conexões não autorizadas (para desenvolvimento)
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  })
}

/**
 * Email padrão do remetente
 */
export const DEFAULT_FROM_EMAIL = 'suporte@brasilpsd.com.br'
export const DEFAULT_FROM_NAME = 'BrasilPSD'


import nodemailer from 'nodemailer'

/**
 * Configuração do servidor SMTP (Hostinger)
 * Baseado nas informações da imagem fornecida:
 * - Servidor SMTP: smtp.hostinger.com
 * - Porta: 465
 * - SSL/TLS: Habilitado
 */
export function createEmailTransporter() {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    throw new Error(
      'SMTP credentials não configuradas. Configure as seguintes variáveis de ambiente:\n' +
      '- SMTP_HOST\n' +
      '- SMTP_PORT\n' +
      '- SMTP_USER\n' +
      '- SMTP_PASSWORD'
    )
  }

  const port = parseInt(smtpPort)
  if (isNaN(port)) {
    throw new Error('SMTP_PORT deve ser um número válido')
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: port,
    secure: port === 465, // true para porta 465, false para outras portas
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


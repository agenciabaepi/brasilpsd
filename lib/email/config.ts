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

  console.log('🔧 Configurando SMTP:', {
    host: smtpHost,
    port: smtpPort,
    user: smtpUser,
    hasPassword: !!smtpPassword,
    nodeEnv: process.env.NODE_ENV
  })

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    const missing = []
    if (!smtpHost) missing.push('SMTP_HOST')
    if (!smtpPort) missing.push('SMTP_PORT')
    if (!smtpUser) missing.push('SMTP_USER')
    if (!smtpPassword) missing.push('SMTP_PASSWORD')
    
    throw new Error(
      `SMTP credentials não configuradas. Configure as seguintes variáveis de ambiente: ${missing.join(', ')}`
    )
  }

  const port = parseInt(smtpPort)
  if (isNaN(port)) {
    throw new Error(`SMTP_PORT deve ser um número válido. Recebido: ${smtpPort}`)
  }

  const transporter = nodemailer.createTransport({
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
      minVersion: 'TLSv1.2',
    },
    // Timeout para conexão
    connectionTimeout: 15000, // 15 segundos (aumentado)
    // Timeout para comandos
    greetingTimeout: 10000, // 10 segundos (aumentado)
    // Socket timeout
    socketTimeout: 15000, // 15 segundos (aumentado)
    debug: true, // Sempre habilitar debug para identificar problemas
    logger: true, // Sempre logar para identificar problemas
    // Pool de conexões desabilitado para evitar problemas de conexão
    pool: false,
    // Retry em caso de falha
    maxRetries: 3,
    retryDelay: 2000,
  })

  return transporter
}

/**
 * Email padrão do remetente
 */
export const DEFAULT_FROM_EMAIL = 'suporte@brasilpsd.com.br'
export const DEFAULT_FROM_NAME = 'BrasilPSD'


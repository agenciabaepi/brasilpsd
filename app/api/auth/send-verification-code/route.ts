import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient, createSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Envia código de verificação por email
 * POST /api/auth/send-verification-code
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email não informado' }, { status: 400 })
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Verificar se email já está cadastrado E verificado
    // Se estiver verificado, não permitir reenvio
    try {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = users.find(u => u.email === email)
      
      if (existingUser && existingUser.email_confirmed_at) {
        return NextResponse.json({ error: 'Este email já está cadastrado e verificado' }, { status: 400 })
      }
      
      // Se o usuário existe mas não foi verificado, permitir reenvio
      if (existingUser && !existingUser.email_confirmed_at) {
        console.log('⚠️ Usuário existe mas email não foi verificado, permitindo reenvio:', email)
      }
    } catch (checkError) {
      // Se falhar a verificação, continuar (pode ser que não exista ainda)
      console.warn('Aviso ao verificar email existente:', checkError)
    }

    const supabase = createRouteHandlerSupabaseClient()

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Expira em 15 minutos
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    // Salvar código no banco
    const { error: insertError } = await supabase
      .from('email_verification_codes')
      .insert({
        email,
        code,
        expires_at: expiresAt.toISOString(),
        verified: false
      })

    if (insertError) {
      console.error('Erro ao salvar código de verificação:', insertError)
      return NextResponse.json({ error: 'Erro ao gerar código de verificação' }, { status: 500 })
    }

    // Verificar se SMTP está configurado antes de tentar enviar
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASSWORD

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      const missing = []
      if (!smtpHost) missing.push('SMTP_HOST')
      if (!smtpPort) missing.push('SMTP_PORT')
      if (!smtpUser) missing.push('SMTP_USER')
      if (!smtpPassword) missing.push('SMTP_PASSWORD')
      
      console.error('❌ SMTP não configurado. Variáveis faltando:', missing.join(', '))
      
      // Em desenvolvimento, retornar o código mesmo sem SMTP configurado
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEV] SMTP não configurado. Código de verificação para ${email}: ${code}`)
        console.log(`⏰ Expira em: ${expiresAt.toISOString()}`)
        return NextResponse.json({ 
          success: true,
          message: 'Código de verificação gerado (SMTP não configurado - modo desenvolvimento)',
          code,
          warning: 'SMTP não configurado. Configure as variáveis de ambiente SMTP_* para enviar emails.'
        })
      }
      
      return NextResponse.json({ 
        error: 'Serviço de email não configurado',
        message: `As seguintes variáveis de ambiente estão faltando: ${missing.join(', ')}. Configure o SMTP para enviar emails.`,
        code: process.env.NODE_ENV === 'development' ? code : undefined
      }, { status: 500 })
    }

    // Enviar email com código
    try {
      const { sendVerificationCodeEmail } = await import('@/lib/email/sender')
      await sendVerificationCodeEmail(email, code)
      console.log('✅ Email de verificação enviado com sucesso para:', email)
    } catch (emailError: any) {
      console.error('❌ Erro ao enviar email de verificação:', {
        email,
        error: emailError.message,
        stack: emailError.stack,
        code: emailError.code,
        command: emailError.command,
        response: emailError.response,
        responseCode: emailError.responseCode,
        hostname: emailError.hostname,
        port: emailError.port
      })
      
      // Em desenvolvimento, sempre retornar o código mesmo se falhar
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEV] Erro ao enviar email, mas retornando código para desenvolvimento: ${code}`)
        console.log(`⏰ Expira em: ${expiresAt.toISOString()}`)
        return NextResponse.json({ 
          success: true,
          message: 'Código de verificação gerado (erro ao enviar email - modo desenvolvimento)',
          code,
          warning: `Erro ao enviar email: ${emailError.message}. Use o código acima para testar.`
        })
      }
      
      // Em produção, retornar erro mas ainda permitir usar o código se necessário
      return NextResponse.json({ 
        error: 'Erro ao enviar email de verificação',
        message: emailError.message || 'Não foi possível enviar o email. Verifique as configurações SMTP.',
        details: emailError.message,
        // Não retornar código em produção por segurança
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Código de verificação gerado',
      // Em desenvolvimento, retornar o código (remover em produção)
      ...(process.env.NODE_ENV === 'development' && { code })
    })
  } catch (error: any) {
    console.error('Erro ao enviar código de verificação:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao enviar código de verificação' 
    }, { status: 500 })
  }
}


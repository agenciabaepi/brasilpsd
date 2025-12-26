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

    // Verificar se email já está cadastrado (usar admin para buscar em auth.users)
    try {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = users.find(u => u.email === email)
      
      if (existingUser) {
        return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 400 })
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

    // Enviar email com código
    try {
      const { sendVerificationCodeEmail } = await import('@/lib/email/sender')
      await sendVerificationCodeEmail(email, code)
    } catch (emailError: any) {
      console.error('Erro ao enviar email de verificação:', emailError)
      // Continuar mesmo se falhar o envio de email (em desenvolvimento pode logar)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 Código de verificação para ${email}: ${code}`)
        console.log(`⏰ Expira em: ${expiresAt.toISOString()}`)
      }
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


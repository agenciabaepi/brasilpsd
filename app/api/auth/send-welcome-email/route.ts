import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/sender'

export const dynamic = 'force-dynamic'

/**
 * Envia email de boas-vindas após ativar conta
 * POST /api/auth/send-welcome-email
 * Body: { email: string, userName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, userName } = await request.json()

    if (!email || !userName) {
      return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Enviar email de boas-vindas
    try {
      await sendWelcomeEmail(email, userName)
      console.log('✅ Email de boas-vindas enviado com sucesso para:', email)
      return NextResponse.json({ 
        success: true,
        message: 'Email de boas-vindas enviado com sucesso'
      })
    } catch (emailError: any) {
      console.error('❌ Erro ao enviar email de boas-vindas:', {
        email,
        error: emailError.message,
      })
      return NextResponse.json({ 
        error: 'Erro ao enviar email de boas-vindas',
        message: emailError.message || 'Não foi possível enviar o email.'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Erro ao enviar email de boas-vindas:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao enviar email de boas-vindas' 
    }, { status: 500 })
  }
}


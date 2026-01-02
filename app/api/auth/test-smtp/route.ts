import { NextRequest, NextResponse } from 'next/server'
import { createEmailTransporter } from '@/lib/email/config'

export const dynamic = 'force-dynamic'

/**
 * Testa a conexão SMTP
 * GET /api/auth/test-smtp
 */
export async function GET(request: NextRequest) {
  try {
    const transporter = createEmailTransporter()
    
    console.log('🧪 Testando conexão SMTP...')
    
    // Verificar conexão
    const verified = await transporter.verify()
    
    if (verified) {
      return NextResponse.json({ 
        success: true,
        message: 'Conexão SMTP verificada com sucesso',
        verified: true
      })
    } else {
      return NextResponse.json({ 
        success: false,
        message: 'Falha ao verificar conexão SMTP',
        verified: false
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('❌ Erro ao testar SMTP:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      hostname: error.hostname,
      port: error.port,
      stack: error.stack,
    })
    
    return NextResponse.json({ 
      success: false,
      message: 'Erro ao testar conexão SMTP',
      error: error.message,
      details: {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        hostname: error.hostname,
        port: error.port,
      }
    }, { status: 500 })
  }
}

/**
 * Envia um email de teste
 * POST /api/auth/test-smtp
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email não informado' }, { status: 400 })
    }
    
    const { sendVerificationCodeEmail } = await import('@/lib/email/sender')
    const testCode = '123456'
    
    console.log('🧪 Enviando email de teste para:', email)
    
    await sendVerificationCodeEmail(email, testCode, 'Teste')
    
    return NextResponse.json({ 
      success: true,
      message: 'Email de teste enviado com sucesso',
      code: testCode
    })
  } catch (error: any) {
    console.error('❌ Erro ao enviar email de teste:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    })
    
    return NextResponse.json({ 
      success: false,
      message: 'Erro ao enviar email de teste',
      error: error.message,
      details: {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      }
    }, { status: 500 })
  }
}


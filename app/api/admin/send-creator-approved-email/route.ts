import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { sendCreatorApprovedEmail } from '@/lib/email/sender'

export const dynamic = 'force-dynamic'

/**
 * Envia email quando criador é aprovado
 * POST /api/admin/send-creator-approved-email
 * Body: { email: string, userName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar autenticação e admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { email, userName } = await request.json()

    if (!email || !userName) {
      return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Enviar email
    try {
      await sendCreatorApprovedEmail(email, userName)
      console.log('✅ Email de criador aprovado enviado com sucesso para:', email)
      return NextResponse.json({ 
        success: true,
        message: 'Email enviado com sucesso'
      })
    } catch (emailError: any) {
      console.error('❌ Erro ao enviar email de criador aprovado:', {
        email,
        error: emailError.message,
      })
      return NextResponse.json({ 
        error: 'Erro ao enviar email',
        message: emailError.message || 'Não foi possível enviar o email.'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Erro ao enviar email de criador aprovado:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao enviar email' 
    }, { status: 500 })
  }
}


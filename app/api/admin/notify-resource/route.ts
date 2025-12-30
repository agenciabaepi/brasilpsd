import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { sendResourceApprovedEmail, sendResourceRejectedEmail } from '@/lib/email/sender'

export const dynamic = 'force-dynamic'

/**
 * API route para enviar notificações por email quando recursos são aprovados/rejeitados
 * POST /api/admin/notify-resource
 * Body: { resourceId: string, action: 'approved' | 'rejected', reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
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

    const { resourceId, action, reason } = await request.json()

    if (!resourceId || !action) {
      return NextResponse.json({ error: 'resourceId e action são obrigatórios' }, { status: 400 })
    }

    if (action !== 'approved' && action !== 'rejected') {
      return NextResponse.json({ error: 'action deve ser "approved" ou "rejected"' }, { status: 400 })
    }

    // Buscar dados do recurso e criador
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select(`
        *,
        creator:profiles!creator_id(email, full_name)
      `)
      .eq('id', resourceId)
      .single()

    if (resourceError || !resource) {
      return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 })
    }

    if (!resource.creator || !resource.creator.email) {
      return NextResponse.json({ error: 'Criador não encontrado' }, { status: 404 })
    }

    // Enviar email apropriado
    try {
      if (action === 'approved') {
        await sendResourceApprovedEmail(
          resource.creator.email,
          resource.creator.full_name || 'Criador',
          resource.title,
          resourceId
        )
      } else {
        await sendResourceRejectedEmail(
          resource.creator.email,
          resource.creator.full_name || 'Criador',
          resource.title,
          reason
        )
      }

      return NextResponse.json({ success: true, message: 'Email enviado com sucesso' })
    } catch (emailError: any) {
      console.error('Erro ao enviar email:', emailError)
      return NextResponse.json({ 
        error: 'Erro ao enviar email', 
        details: emailError.message 
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Erro na API de notificação:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao processar requisição' 
    }, { status: 500 })
  }
}





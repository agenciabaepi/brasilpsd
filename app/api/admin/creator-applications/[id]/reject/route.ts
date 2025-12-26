import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar autenticação e admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_admin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem rejeitar solicitações.' },
        { status: 403 }
      )
    }

    // Obter motivo da rejeição do corpo da requisição
    const body = await request.json()
    const { rejected_reason } = body

    // Buscar a solicitação
    const { data: application, error: fetchError } = await supabase
      .from('creator_applications')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !application) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada' },
        { status: 404 }
      )
    }

    if (application.status !== 'pending') {
      return NextResponse.json(
        { error: 'Esta solicitação já foi processada' },
        { status: 400 }
      )
    }

    // Atualizar status para rejected
    const { error: updateError } = await supabase
      .from('creator_applications')
      .update({
        status: 'rejected',
        rejected_reason: rejected_reason || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Erro ao rejeitar solicitação:', updateError)
      return NextResponse.json(
        { error: 'Erro ao rejeitar solicitação' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Solicitação rejeitada' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Erro no endpoint de rejeição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}


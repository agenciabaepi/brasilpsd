import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { sendCreatorApprovedEmail } from '@/lib/email/sender'

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
        { error: 'Acesso negado. Apenas administradores podem aprovar solicitações.' },
        { status: 403 }
      )
    }

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

    // Atualizar status para approved (o trigger vai atualizar o perfil automaticamente)
    const { error: updateError } = await supabase
      .from('creator_applications')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Erro ao aprovar solicitação:', updateError)
      return NextResponse.json(
        { error: 'Erro ao aprovar solicitação' },
        { status: 500 }
      )
    }

    // O trigger handle_creator_application_approval vai atualizar o perfil automaticamente
    // Mas vamos garantir aqui também
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        is_creator: true,
        role: 'creator',
        updated_at: new Date().toISOString()
      })
      .eq('id', application.user_id)

    if (profileUpdateError) {
      console.error('Erro ao atualizar perfil:', profileUpdateError)
      // Não falhar se o trigger já atualizou
    }

    // Enviar email ao criador aprovado (não bloquear se falhar)
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', application.user_id)
        .single()

      if (userProfile && userProfile.email) {
        await sendCreatorApprovedEmail(
          userProfile.email,
          userProfile.full_name || 'Criador'
        )
        console.log('✅ Email de criador aprovado enviado para:', userProfile.email)
      }
    } catch (emailError) {
      console.error('Erro ao enviar email de aprovação de criador:', emailError)
      // Não bloquear aprovação se email falhar
    }

    return NextResponse.json(
      { message: 'Solicitação aprovada com sucesso' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Erro no endpoint de aprovação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}



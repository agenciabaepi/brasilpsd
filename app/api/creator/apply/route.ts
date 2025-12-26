import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Verificar se já é criador
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator')
      .eq('id', user.id)
      .single()

    if (profile?.is_creator) {
      return NextResponse.json(
        { error: 'Você já é um criador' },
        { status: 400 }
      )
    }

    // Verificar se já tem uma solicitação pendente
    const { data: existingApplication } = await supabase
      .from('creator_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (existingApplication) {
      if (existingApplication.status === 'pending') {
        return NextResponse.json(
          { error: 'Você já tem uma solicitação pendente' },
          { status: 400 }
        )
      }
      if (existingApplication.status === 'approved') {
        return NextResponse.json(
          { error: 'Você já é um criador aprovado' },
          { status: 400 }
        )
      }
      // Se foi rejeitada, pode criar uma nova (deletar a antiga primeiro)
      await supabase
        .from('creator_applications')
        .delete()
        .eq('id', existingApplication.id)
    }

    // Obter dados do corpo da requisição
    const body = await request.json()
    const { portfolio_url, is_contributor_on_other_platform, other_platform_name } = body

    // Validações
    if (!portfolio_url || typeof portfolio_url !== 'string' || !portfolio_url.trim()) {
      return NextResponse.json(
        { error: 'Link do portfólio é obrigatório' },
        { status: 400 }
      )
    }

    // Validar URL
    try {
      new URL(portfolio_url)
    } catch {
      return NextResponse.json(
        { error: 'Link do portfólio deve ser uma URL válida' },
        { status: 400 }
      )
    }

    // Criar solicitação
    const { data: application, error: insertError } = await supabase
      .from('creator_applications')
      .insert({
        user_id: user.id,
        portfolio_url: portfolio_url.trim(),
        is_contributor_on_other_platform: is_contributor_on_other_platform || false,
        other_platform_name: is_contributor_on_other_platform && other_platform_name
          ? other_platform_name.trim()
          : null,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro ao criar solicitação:', insertError)
      return NextResponse.json(
        { error: 'Erro ao criar solicitação. Tente novamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Solicitação criada com sucesso',
        application 
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Erro no endpoint de aplicação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}


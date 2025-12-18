import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

export async function GET(request: NextRequest) {
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

    // Buscar assinaturas do Asaas
    try {
      const subscriptions = await asaas.getSubscriptions()
      return NextResponse.json({ subscriptions: subscriptions.data || [] })
    } catch (asaasError: any) {
      console.error('Erro ao buscar assinaturas do Asaas:', asaasError)
      // Retornar array vazio em vez de erro, para não quebrar a página
      // O admin ainda pode ver os usuários premium do nosso banco
      return NextResponse.json({ 
        subscriptions: [],
        warning: asaasError.message || 'Não foi possível sincronizar com o Asaas'
      })
    }
  } catch (error: any) {
    console.error('Erro geral ao listar assinaturas:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao listar assinaturas', subscriptions: [] },
      { status: 500 }
    )
  }
}


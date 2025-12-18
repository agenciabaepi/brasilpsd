import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { asaasId } = await request.json()

    if (!asaasId) {
      return NextResponse.json({ error: 'ID da assinatura Asaas não fornecido' }, { status: 400 })
    }

    // Reativar no Asaas
    await asaas.reactivateSubscription(asaasId)

    // Buscar dados da assinatura para atualizar o tier
    const subscription = await asaas.getSubscription(asaasId)
    const tier = subscription.externalReference || 'pro'

    // Atualizar no nosso banco
    await supabase
      .from('profiles')
      .update({ is_premium: true, subscription_tier: tier })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao reativar assinatura:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao reativar assinatura' },
      { status: 500 }
    )
  }
}


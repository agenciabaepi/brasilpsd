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

    // Buscar a assinatura no banco de dados
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
    }

    // Se tiver asaasId, tentar reativar no Asaas (pode ser null para assinaturas próprias)
    if (asaasId) {
      try {
        await asaas.reactivateSubscription(asaasId)
      } catch (error: any) {
        // Se falhar no Asaas, continuar mesmo assim para atualizar no nosso banco
        console.warn('Erro ao reativar no Asaas (continuando mesmo assim):', error.message)
      }
    }

    // Atualizar assinatura no nosso banco
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        canceled_at: null,
        expires_at: null,
        auto_renew: true
      })
      .eq('id', id)

    if (updateError) {
      console.error('Erro ao atualizar assinatura:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar assinatura no banco' }, { status: 500 })
    }

    // Atualizar perfil do usuário
    await supabase
      .from('profiles')
      .update({ 
        is_premium: true, 
        subscription_tier: subscription.tier 
      })
      .eq('id', subscription.user_id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao reativar assinatura:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao reativar assinatura' },
      { status: 500 }
    )
  }
}


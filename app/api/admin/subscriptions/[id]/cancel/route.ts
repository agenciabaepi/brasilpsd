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

    // Cancelar no Asaas
    await asaas.cancelSubscription(asaasId)

    // Atualizar no nosso banco
    await supabase
      .from('profiles')
      .update({ is_premium: false, subscription_tier: 'free' })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao cancelar assinatura:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao cancelar assinatura' },
      { status: 500 }
    )
  }
}


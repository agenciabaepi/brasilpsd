import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

export async function GET(
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

    // Buscar dados do usuário
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Buscar assinatura no Asaas (se existir asaas_customer_id)
    let payments: any[] = []
    let subscriptionData: any = null
    if (userProfile.asaas_customer_id) {
      try {
        const subscriptionsResponse = await asaas.getSubscriptions({ customer: userProfile.asaas_customer_id })
        if (subscriptionsResponse.data && subscriptionsResponse.data.length > 0) {
          subscriptionData = subscriptionsResponse.data[0]
          const paymentsData = await asaas.getSubscriptionPayments(subscriptionData.id)
          payments = paymentsData.data || []
        }
      } catch (error) {
        console.warn('Erro ao buscar pagamentos do Asaas:', error)
      }
    }

    return NextResponse.json({ 
      user: userProfile,
      subscription: subscriptionData,
      payments: payments.map((p: any) => ({
        id: p.id,
        value: p.value,
        status: p.status,
        dueDate: p.dueDate,
        paymentDate: p.paymentDate,
        billingType: p.billingType
      }))
    })
  } catch (error: any) {
    console.error('Erro ao buscar detalhes:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao buscar detalhes' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { tier, method, billingCycle, creditCard, creditCardHolderInfo } = await request.json()

    // 1. Configuração de Preços e Ciclos
    const prices: Record<string, any> = {
      'lite': { monthly: 19.90, yearly: 16.90 * 12 },
      'pro': { monthly: 29.90, yearly: 24.90 * 12 },
      'plus': { monthly: 49.90, yearly: 39.90 * 12 }
    }

    const tierData = prices[tier.toLowerCase()]
    const amount = billingCycle === 'yearly' ? tierData.yearly : tierData.monthly
    const asaasCycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'

    if (!amount) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    // 2. Obter/Criar Cliente no Asaas
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    let asaasCustomerId = profile?.asaas_customer_id
    
    if (!asaasCustomerId) {
      asaasCustomerId = await asaas.getOrCreateCustomer({
        id: user.id,
        email: user.email!,
        full_name: profile?.full_name || 'Usuário BrasilPSD'
      })
      // Salvar o ID do cliente no nosso banco
      await supabase
        .from('profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', user.id)
    }

    // 3. Criar Assinatura no Asaas
    const subscriptionData = await asaas.createSubscription({
      customerId: asaasCustomerId,
      amount,
      tier,
      billingType: method, // 'PIX', 'BOLETO' ou 'CREDIT_CARD'
      cycle: asaasCycle,
      creditCard,
      creditCardHolderInfo
    })

    // 4. Registrar na nossa tabela de Transações (referente à primeira parcela)
    await supabase.from('transactions').insert({
      user_id: user.id,
      subscription_tier: tier,
      amount_brute: amount,
      amount_liquid: amount, 
      payment_method: `asaas_${method.toLowerCase()}`,
      status: 'pending',
      id: method === 'CREDIT_CARD' ? subscriptionData.id : subscriptionData.paymentId
    })

    return NextResponse.json(subscriptionData)

  } catch (error: any) {
    console.error('Checkout Error:', error)
    return NextResponse.json({ error: error.message || 'Falha ao processar assinatura' }, { status: 500 })
  }
}

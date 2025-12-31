import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

/**
 * Endpoint para trocar de plano
 * Inativa o plano atual e cria um novo pagamento para o novo plano
 * POST /api/finance/change-plan
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { newTier, billingCycle } = await request.json()

    if (!newTier || !['lite', 'pro', 'plus'].includes(newTier)) {
      return NextResponse.json({ error: 'Tier inválido' }, { status: 400 })
    }

    // Buscar perfil e assinatura ativa
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Buscar assinatura ativa
    const { data: activeSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Se já tem o mesmo plano, retornar erro
    if (activeSubscription && activeSubscription.tier === newTier) {
      return NextResponse.json({ 
        error: 'Você já possui este plano ativo' 
      }, { status: 400 })
    }

    // Preços
    const prices: Record<string, any> = {
      'lite': { monthly: 19.90, yearly: 19.90 },
      'pro': { monthly: 29.90, yearly: 29.90 },
      'plus': { monthly: 49.90, yearly: 49.90 }
    }

    const tierData = prices[newTier.toLowerCase()]
    const amount = billingCycle === 'yearly' ? tierData.yearly : tierData.monthly

    // Se tem assinatura ativa, inativar
    if (activeSubscription) {
      console.log(`🔄 Inativando assinatura ${activeSubscription.id} para troca de plano`)
      
      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          expires_at: new Date().toISOString()
        })
        .eq('id', activeSubscription.id)

      // Remover premium temporariamente (será reativado quando novo pagamento for confirmado)
      await supabase
        .from('profiles')
        .update({
          is_premium: false,
          subscription_tier: null
        })
        .eq('id', user.id)
    }

    // Obter/Criar Cliente no Asaas
    let asaasCustomerId = profile?.asaas_customer_id
    
    if (!asaasCustomerId) {
      if (!profile.cpf_cnpj) {
        return NextResponse.json({ 
          error: 'CPF/CNPJ é obrigatório para realizar pagamentos. Por favor, complete seu cadastro na página de configurações.' 
        }, { status: 400 })
      }

      asaasCustomerId = await asaas.getOrCreateCustomer({
        id: user.id,
        email: user.email!,
        full_name: profile?.full_name || 'Usuário BrasilPSD',
        cpf_cnpj: profile.cpf_cnpj
      })
      
      await supabase
        .from('profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', user.id)
    }

    // Criar novo pagamento para o novo plano
    const paymentData = await asaas.createPayment({
      customerId: asaasCustomerId,
      amount,
      billingType: 'PIX', // Por padrão PIX para troca de plano
      description: `Troca de Plano BrasilPSD - Plano ${newTier.toUpperCase()} (${billingCycle === 'monthly' ? 'Mensal' : 'Anual'})`,
      externalReference: `${newTier}_${user.id}`
    })

    const paymentId = paymentData.paymentId || paymentData.id

    // Criar transação pendente
    await supabase.from('transactions').insert({
      id: paymentId,
      user_id: user.id,
      subscription_tier: newTier,
      amount_brute: amount,
      amount_liquid: amount, 
      payment_method: 'asaas_pix',
      status: 'pending'
    })

    return NextResponse.json({
      success: true,
      message: 'Plano alterado! Realize o pagamento para ativar o novo plano.',
      payment: paymentData
    })
  } catch (error: any) {
    console.error('Erro ao trocar plano:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao trocar plano' 
    }, { status: 500 })
  }
}


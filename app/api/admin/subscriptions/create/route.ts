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

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { userId, tier, billingType, billingCycle } = await request.json()

    if (!userId || !tier || !billingType || !billingCycle) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Validar método de pagamento (admin só pode criar com PIX ou BOLETO)
    if (billingType !== 'PIX' && billingType !== 'BOLETO') {
      return NextResponse.json({ 
        error: 'Método de pagamento inválido. Apenas PIX e BOLETO são permitidos para criação pelo admin.' 
      }, { status: 400 })
    }

    // Verificar se o usuário existe
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar se o usuário já tem assinatura ativa
    if (userProfile.is_premium) {
      return NextResponse.json({ 
        error: 'Usuário já possui uma assinatura ativa. Cancele a assinatura atual antes de criar uma nova.' 
      }, { status: 400 })
    }

    // Configuração de Preços e Ciclos
    const prices: Record<string, any> = {
      'lite': { monthly: 19.90, yearly: 19.90 },
      'pro': { monthly: 29.90, yearly: 29.90 },
      'plus': { monthly: 49.90, yearly: 49.90 }
    }

    const tierData = prices[tier.toLowerCase()]
    if (!tierData) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    const amount = billingCycle === 'yearly' ? tierData.yearly : tierData.monthly
    const asaasCycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'

    // Verificar se tem CPF/CNPJ
    if (!userProfile.cpf_cnpj) {
      return NextResponse.json({ 
        error: 'O usuário precisa ter CPF/CNPJ cadastrado para criar assinaturas. Peça para o usuário completar o cadastro na página de configurações.' 
      }, { status: 400 })
    }

    // Obter/Criar Cliente no Asaas
    let asaasCustomerId = userProfile.asaas_customer_id
    
    if (!asaasCustomerId) {
      asaasCustomerId = await asaas.getOrCreateCustomer({
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name || 'Usuário BrasilPSD',
        cpf_cnpj: userProfile.cpf_cnpj
      })
      
      // Salvar o ID do cliente no nosso banco
      await supabase
        .from('profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', userId)
    } else {
      // Se cliente já existe, atualizar CPF se necessário
      try {
        await asaas.getOrCreateCustomer({
          id: userProfile.id,
          email: userProfile.email,
          full_name: userProfile.full_name || 'Usuário BrasilPSD',
          cpf_cnpj: userProfile.cpf_cnpj
        })
      } catch (error: any) {
        console.warn('Erro ao atualizar cliente Asaas:', error.message)
      }
    }

    // Para PIX e BOLETO, criar pagamento único (não assinatura)
    // O Asaas não permite PIX/BOLETO em assinaturas recorrentes
    let paymentData: any
    
    if (billingType === 'PIX' || billingType === 'BOLETO') {
      // Criar pagamento único
      paymentData = await asaas.createPayment({
      customerId: asaasCustomerId,
      amount,
        billingType,
        description: `Assinatura BrasilPSD - Plano ${tier.toUpperCase()} (${billingCycle === 'monthly' ? 'Mensal' : 'Anual'})`,
        externalReference: `${userProfile.id}_${tier}_${Date.now()}`
    })

    // Para PIX e BOLETO, não marcar como premium ainda - aguardar confirmação via webhook
    // Apenas atualizar o tier no perfil
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier.toLowerCase()
        // is_premium será atualizado pelo webhook quando o pagamento for confirmado
      })
      .eq('id', userId)

    // Registrar transação como pendente
    await supabase.from('transactions').insert({
        id: paymentData.id,
      user_id: userId,
      subscription_tier: tier.toLowerCase(),
      amount_brute: amount,
      amount_liquid: amount,
      payment_method: `asaas_${billingType.toLowerCase()}`,
        status: 'pending'
    })

    return NextResponse.json({ 
      success: true,
        payment: paymentData,
        message: 'Pagamento criado com sucesso! O acesso será liberado após a confirmação do pagamento.'
    })
    } else {
      // Para cartão de crédito, criar assinatura recorrente
      return NextResponse.json({ 
        error: 'Cartão de crédito não é permitido para criação pelo admin. Use PIX ou BOLETO.' 
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Erro ao criar assinatura:', error)
    
    // Verificar se é erro de configuração do Asaas
    if (error.message?.includes('API Key faltando') || error.message?.includes('Configuração de pagamento incompleta')) {
      return NextResponse.json({ 
        error: 'Configuração do Asaas incompleta. Configure a variável ASAAS_API_KEY no arquivo .env.local',
        code: 'ASAAS_NOT_CONFIGURED'
      }, { status: 503 }) // 503 Service Unavailable
    }
    
    return NextResponse.json({ 
      error: error.message || 'Falha ao criar assinatura' 
    }, { status: 500 })
  }
}


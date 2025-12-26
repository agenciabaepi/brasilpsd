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

    // 1. Configuração de Preços e Ciclos (valores mínimos para testes - mínimo do Asaas é R$ 5,00)
    const prices: Record<string, any> = {
      'lite': { monthly: 5.00, yearly: 5.00 },
      'pro': { monthly: 6.00, yearly: 6.00 },
      'plus': { monthly: 7.00, yearly: 7.00 }
    }

    const tierData = prices[tier.toLowerCase()]
    const amount = billingCycle === 'yearly' ? tierData.yearly : tierData.monthly
    const asaasCycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'

    if (!amount) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    // 2. Obter/Criar Cliente no Asaas
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    
    if (!profile) {
      return NextResponse.json({ 
        error: 'Perfil não encontrado. Por favor, complete seu cadastro.' 
      }, { status: 400 })
    }
    
    if (!profile.cpf_cnpj) {
      return NextResponse.json({ 
        error: 'CPF/CNPJ é obrigatório para realizar pagamentos. Por favor, complete seu cadastro na página de configurações.' 
      }, { status: 400 })
    }

    // Validar formato do CPF/CNPJ (deve ter pelo menos 11 dígitos)
    const cpfCnpjClean = profile.cpf_cnpj.replace(/\D/g, '')
    if (cpfCnpjClean.length < 11) {
      return NextResponse.json({ 
        error: 'CPF/CNPJ inválido. Por favor, verifique os dados na página de configurações.' 
      }, { status: 400 })
    }
    
    let asaasCustomerId = profile.asaas_customer_id
    
    // Sempre verificar/criar o customer para garantir que está válido
    try {
      asaasCustomerId = await asaas.getOrCreateCustomer({
        id: user.id,
        email: user.email!,
        full_name: profile.full_name || 'Usuário BrasilPSD',
        cpf_cnpj: profile.cpf_cnpj
      })

      if (!asaasCustomerId) {
        throw new Error('Falha ao criar/obter customer no Asaas')
      }

      // Salvar o ID do cliente no nosso banco (atualizar sempre para garantir sincronização)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', user.id)

      if (updateError) {
        console.error('Erro ao salvar asaas_customer_id:', updateError)
        // Não bloquear o fluxo, mas logar o erro
      }
    } catch (error: any) {
      console.error('Erro ao obter/criar customer no Asaas:', error)
      return NextResponse.json({ 
        error: error.message || 'Erro ao conectar com Asaas: Customer inválido ou não informado' 
      }, { status: 500 })
    }

    // 3. Validar que temos um customerId válido
    if (!asaasCustomerId) {
      return NextResponse.json({ 
        error: 'Erro ao conectar com Asaas: Customer inválido ou não informado' 
      }, { status: 500 })
    }

    // 4. Criar Assinatura ou Pagamento no Asaas
    let paymentData: any

    if (method === 'CREDIT_CARD') {
      // Para cartão de crédito, criar assinatura recorrente
      paymentData = await asaas.createSubscription({
        customerId: asaasCustomerId,
        amount,
        tier,
        billingType: method,
        cycle: asaasCycle,
        creditCard,
        creditCardHolderInfo
      })

      // Registrar transação como paga (cartão é aprovado imediatamente)
    await supabase.from('transactions').insert({
        id: paymentData.id,
        user_id: user.id,
        subscription_tier: tier,
        amount_brute: amount,
        amount_liquid: amount, 
        payment_method: `asaas_${method.toLowerCase()}`,
        status: 'paid'
      })

      // Ativar premium imediatamente para cartão
      await supabase
        .from('profiles')
        .update({
          is_premium: true,
          subscription_tier: tier.toLowerCase()
        })
        .eq('id', user.id)

      // Enviar email de confirmação de assinatura (cartão é aprovado imediatamente)
      try {
        const { sendSubscriptionConfirmationEmail } = await import('@/lib/email/sender')
        await sendSubscriptionConfirmationEmail(
          user.email!,
          profile.full_name || 'Usuário',
          tier.toUpperCase(),
          amount,
          billingCycle
        )
      } catch (emailError) {
        console.error('Erro ao enviar email de confirmação de assinatura:', emailError)
        // Não falhar o checkout se o email falhar
      }

      return NextResponse.json(paymentData)
    } else {
      // Para PIX e BOLETO, criar pagamento único (não assinatura)
      // Formato do externalReference: tier_userId para facilitar identificação
      if (!asaasCustomerId) {
        return NextResponse.json({ 
          error: 'Erro ao conectar com Asaas: Customer inválido ou não informado' 
        }, { status: 500 })
      }

      paymentData = await asaas.createPayment({
        customerId: asaasCustomerId,
        amount,
        billingType: method,
        description: `Assinatura BrasilPSD - Plano ${tier.toUpperCase()} (${billingCycle === 'monthly' ? 'Mensal' : 'Anual'})`,
        externalReference: `${tier}_${user.id}` // Formato: tier_userId
      })

      // O ID do pagamento pode vir em paymentId ou id
      const paymentId = paymentData.paymentId || paymentData.id
      
      if (!paymentId) {
        console.error('❌ ID do pagamento não encontrado na resposta:', JSON.stringify(paymentData, null, 2))
        throw new Error('ID do pagamento não retornado pelo Asaas')
      }

      console.log(`📝 Criando transação pendente para pagamento ${paymentId}`)
      console.log(`📊 Dados do pagamento:`, {
        paymentId,
        userId: user.id,
        tier,
        amount,
        method
      })

      // Registrar transação como pendente no banco de dados
      // A assinatura será criada apenas quando o pagamento for confirmado
      const { data: insertedTransaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          id: paymentId,
      user_id: user.id,
      subscription_tier: tier,
      amount_brute: amount,
      amount_liquid: amount, 
      payment_method: `asaas_${method.toLowerCase()}`,
          status: 'pending'
        })
        .select()
        .single()

      if (transactionError) {
        console.error('❌ Erro ao criar transação:', {
          error: transactionError,
          code: transactionError.code,
          message: transactionError.message,
          details: transactionError.details,
          hint: transactionError.hint
        })
        
        // Se o erro for de duplicação, a transação já existe (ok)
        if (transactionError.code === '23505') {
          console.log(`⚠️ Transação ${paymentId} já existe no banco, continuando...`)
        } else {
          // Para outros erros, lançar exceção para não continuar sem transação
          throw new Error(`Erro ao criar transação: ${transactionError.message}`)
        }
      } else {
        console.log(`✅ Transação ${paymentId} criada como pendente:`, insertedTransaction)
      }

      // Retornar dados do pagamento com QR Code ou Boleto
      // Garantir que o paymentId está no retorno para o frontend
      const responseData = {
        ...paymentData,
        paymentId: paymentId, // Garantir que paymentId está presente
        id: paymentId, // Também incluir id para compatibilidade
        // Garantir que qrCode e copyPaste estão presentes para PIX
        qrCode: paymentData.qrCode || null,
        copyPaste: paymentData.copyPaste || paymentData.payload || null
      }
      
      console.log(`✅ Checkout concluído. Retornando dados do pagamento:`, {
        paymentId,
        hasQrCode: !!responseData.qrCode,
        hasCopyPaste: !!responseData.copyPaste,
        hasBankSlipUrl: !!paymentData.bankSlipUrl,
        qrCodeLength: responseData.qrCode?.length || 0,
        copyPasteLength: responseData.copyPaste?.length || 0
      })

      return NextResponse.json(responseData)
    }

  } catch (error: any) {
    console.error('Checkout Error:', error)
    return NextResponse.json({ error: error.message || 'Falha ao processar assinatura' }, { status: 500 })
  }
}

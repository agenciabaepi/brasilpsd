import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { asaas } from '@/lib/asaas/client'

/**
 * Webhook do Asaas para processar eventos de pagamento e assinatura
 * 
 * Eventos suportados:
 * - PAYMENT_RECEIVED: Pagamento recebido (aguardando confirmação)
 * - PAYMENT_CONFIRMED: Pagamento confirmado (liberar acesso)
 * - PAYMENT_OVERDUE: Pagamento em atraso
 * - PAYMENT_DELETED: Pagamento deletado/cancelado
 * - SUBSCRIPTION_CREATED: Assinatura criada
 * - SUBSCRIPTION_UPDATED: Assinatura atualizada
 * - SUBSCRIPTION_DELETED: Assinatura cancelada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createSupabaseAdmin()

    const event = body.event
    const payment = body.payment
    const subscription = body.subscription

    console.log(`📦 Asaas Webhook Recebido [${event}]:`, JSON.stringify({
      event,
      paymentId: payment?.id,
      subscriptionId: subscription?.id,
      customerId: payment?.customer || subscription?.customer,
      paymentStatus: payment?.status,
      paymentValue: payment?.value,
      paymentDescription: payment?.description
    }, null, 2))

    // Processar eventos de pagamento
    if (payment) {
      await processPaymentEvent({
        supabase,
        event,
        payment
      })
    }

    // Processar eventos de assinatura
    if (subscription) {
      await processSubscriptionEvent({
        supabase,
        event,
        subscription
      })
    }

    return NextResponse.json({ received: true, event })
  } catch (error: any) {
    console.error('❌ Erro no webhook Asaas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

/**
 * Processa eventos relacionados a pagamentos
 */
async function processPaymentEvent({
  supabase,
  event,
  payment
}: {
  supabase: any
  event: string
  payment: any
}) {
  try {
    // Buscar usuário pelo customer_id do Asaas
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('asaas_customer_id', payment.customer)
      .single()

    if (!profile) {
      console.warn(`⚠️ Usuário não encontrado para customer_id: ${payment.customer}`)
      return
    }

    // Extrair tier da descrição do pagamento, externalReference ou da assinatura
    let tier = 'lite'
    
    // Tentar extrair do externalReference primeiro (mais confiável)
    if (payment.externalReference) {
      const refParts = payment.externalReference.split('_')
      if (refParts.length >= 2) {
        const possibleTier = refParts[1].toLowerCase()
        if (['lite', 'pro', 'plus'].includes(possibleTier)) {
          tier = possibleTier
        }
      }
    }
    
    // Se não encontrou, tentar da descrição
    if (tier === 'lite' && payment.description) {
      const tierMatch = payment.description.match(/Plano\s+(\w+)/i) || payment.description.match(/(LITE|PRO|PLUS)/i)
      if (tierMatch) {
        tier = tierMatch[1].toLowerCase()
      }
    }

    // Se tiver subscription_id, buscar tier da assinatura
    if (payment.subscription) {
      try {
        const subscriptionData = await asaas.getSubscription(payment.subscription)
        if (subscriptionData.externalReference) {
          tier = subscriptionData.externalReference.toLowerCase()
        }
      } catch (error) {
        console.warn('Erro ao buscar assinatura:', error)
      }
    }
    
    console.log(`📊 Tier identificado: ${tier} para pagamento ${payment.id}`)

    switch (event) {
      case 'PAYMENT_CONFIRMED':
        // Pagamento confirmado - liberar acesso e criar/renovar assinatura
        console.log(`🔄 Processando PAYMENT_CONFIRMED para pagamento ${payment.id}`)
        
        // Verificar se a transação existe, se não, criar
        const { data: existingTransaction } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', payment.id)
          .single()

        if (existingTransaction) {
          // Atualizar transação existente
          const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value),
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)

          if (updateError) {
            console.error('❌ Erro ao atualizar transação:', updateError)
          }
        } else {
          // Criar transação se não existir
          console.log(`📝 Criando transação para pagamento ${payment.id}`)
          const { error: insertError } = await supabase
            .from('transactions')
            .insert({
              id: payment.id,
              user_id: profile.id,
              subscription_tier: tier,
              amount_brute: payment.value,
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value),
              payment_method: `asaas_${payment.billingType?.toLowerCase() || 'pix'}`,
              status: 'paid'
            })
          
          if (insertError) {
            console.error('❌ Erro ao criar transação:', insertError)
          }
        }

        // Criar ou renovar assinatura própria
        await createOrRenewSubscription({
          supabase,
          userId: profile.id,
          tier,
          paymentId: payment.id,
          amount: payment.value,
          paymentMethod: payment.billingType,
          asaasCustomerId: payment.customer
        })

        // Ativar premium
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_premium: true,
            subscription_tier: tier
          })
          .eq('id', profile.id)

        if (profileError) {
          console.error('❌ Erro ao ativar premium:', profileError)
        } else {
          console.log(`✅ Pagamento confirmado - Premium ativado para ${profile.email} (${tier})`)
        }
        break

      case 'PAYMENT_RECEIVED':
        // Pagamento recebido mas ainda não confirmado
        // Atualizar status da transação
        await supabase
          .from('transactions')
          .update({
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id)
          .catch(() => {
            // Se não existir, criar
            supabase.from('transactions').insert({
              id: payment.id,
              user_id: profile.id,
              subscription_tier: tier,
              amount_brute: payment.value,
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value),
              payment_method: `asaas_${payment.billingType?.toLowerCase() || 'unknown'}`,
              status: 'pending'
            })
          })
        break

      case 'PAYMENT_OVERDUE':
        // Pagamento em atraso
        await supabase
          .from('transactions')
          .update({
            status: 'overdue',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id)

        console.log(`⚠️ Pagamento em atraso: ${payment.id}`)
        break

      case 'PAYMENT_DELETED':
        // Pagamento cancelado/deletado
        await supabase
          .from('transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id)
        break
    }
  } catch (error: any) {
    console.error('❌ Erro ao processar evento de pagamento:', error)
    throw error
  }
}

/**
 * Cria ou renova uma assinatura própria quando um pagamento é confirmado
 */
async function createOrRenewSubscription({
  supabase,
  userId,
  tier,
  paymentId,
  amount,
  paymentMethod,
  asaasCustomerId
}: {
  supabase: any
  userId: string
  tier: string
  paymentId: string
  amount: number
  paymentMethod: string
  asaasCustomerId: string
}) {
  try {
    // Verificar se já existe uma assinatura ativa para este usuário
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + 30) // 30 dias a partir de hoje

    if (existingSubscription) {
      // Renovar assinatura existente
      console.log(`🔄 Renovando assinatura ${existingSubscription.id} para usuário ${userId}`)
      
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          tier: tier,
          status: 'active',
          amount: amount,
          current_period_start: now.toISOString().split('T')[0],
          current_period_end: periodEnd.toISOString().split('T')[0],
          last_payment_id: paymentId,
          payment_method: paymentMethod,
          auto_renew: true,
          canceled_at: null,
          expires_at: null
        })
        .eq('id', existingSubscription.id)

      if (updateError) {
        console.error('❌ Erro ao renovar assinatura:', updateError)
        throw updateError
      }

      console.log(`✅ Assinatura renovada até ${periodEnd.toISOString().split('T')[0]}`)
    } else {
      // Criar nova assinatura
      console.log(`📝 Criando nova assinatura para usuário ${userId}`)
      
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier: tier,
          status: 'active',
          amount: amount,
          billing_cycle: 'monthly', // Por padrão mensal (30 dias)
          start_date: now.toISOString().split('T')[0],
          current_period_start: now.toISOString().split('T')[0],
          current_period_end: periodEnd.toISOString().split('T')[0],
          last_payment_id: paymentId,
          asaas_customer_id: asaasCustomerId,
          payment_method: paymentMethod,
          auto_renew: true
        })

      if (insertError) {
        console.error('❌ Erro ao criar assinatura:', insertError)
        throw insertError
      }

      console.log(`✅ Nova assinatura criada até ${periodEnd.toISOString().split('T')[0]}`)
    }
  } catch (error: any) {
    console.error('❌ Erro ao criar/renovar assinatura:', error)
    // Não lançar erro para não quebrar o webhook
  }
}

/**
 * Processa eventos relacionados a assinaturas
 */
async function processSubscriptionEvent({
  supabase,
  event,
  subscription
}: {
  supabase: any
  event: string
  subscription: any
}) {
  try {
    // Buscar usuário pelo customer_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('asaas_customer_id', subscription.customer)
      .single()

    if (!profile) {
      console.warn(`⚠️ Usuário não encontrado para customer_id: ${subscription.customer}`)
      return
    }

    const tier = subscription.externalReference?.toLowerCase() || 'lite'

    switch (event) {
      case 'SUBSCRIPTION_DELETED':
        // Assinatura cancelada - remover premium e cancelar assinatura própria
        await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_tier: null
          })
          .eq('id', profile.id)

        // Cancelar assinatura própria também
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString()
          })
          .eq('user_id', profile.id)
          .eq('status', 'active')

        console.log(`⚠️ Assinatura cancelada - Premium removido de ${profile.email}`)
        break

      case 'SUBSCRIPTION_UPDATED':
        // Assinatura atualizada (mudança de plano, etc)
        await supabase
          .from('profiles')
          .update({
            subscription_tier: tier
          })
          .eq('id', profile.id)

        // Atualizar assinatura própria também
        await supabase
          .from('subscriptions')
          .update({
            tier: tier
          })
          .eq('user_id', profile.id)
          .eq('status', 'active')

        console.log(`📝 Assinatura atualizada para ${profile.email} (${tier})`)
        break
    }
  } catch (error: any) {
    console.error('❌ Erro ao processar evento de assinatura:', error)
    throw error
  }
}


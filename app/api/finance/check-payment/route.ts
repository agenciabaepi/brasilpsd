import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

/**
 * Endpoint para verificar manualmente o status de um pagamento
 * Útil quando o webhook não foi recebido
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { paymentId } = await request.json()

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId é obrigatório' }, { status: 400 })
    }

    // Buscar pagamento no Asaas
    let payment
    try {
      payment = await asaas.fetch(`/payments/${paymentId}`)
    } catch (error: any) {
      console.error('Erro ao buscar pagamento no Asaas:', error)
      return NextResponse.json({ 
        error: 'Pagamento não encontrado no Asaas: ' + error.message 
      }, { status: 404 })
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Se o pagamento foi confirmado ou recebido, atualizar status
    // RECEIVED = pagamento recebido (PIX confirmado)
    // CONFIRMED = pagamento confirmado definitivamente
    const isPaymentConfirmed = payment.status === 'CONFIRMED' || payment.status === 'RECEIVED'
    
    if (isPaymentConfirmed) {
      // Extrair tier do externalReference
      // Formato esperado: tier_userId ou userId_tier_timestamp
      let tier = 'lite'
      if (payment.externalReference) {
        const refParts = payment.externalReference.split('_')
        // Tentar primeiro formato: tier_userId
        if (refParts.length >= 1) {
          const possibleTier = refParts[0].toLowerCase()
          if (['lite', 'pro', 'plus'].includes(possibleTier)) {
            tier = possibleTier
          } else if (refParts.length >= 2) {
            // Tentar segundo formato: userId_tier_timestamp
            const possibleTier2 = refParts[1].toLowerCase()
            if (['lite', 'pro', 'plus'].includes(possibleTier2)) {
              tier = possibleTier2
            }
          }
        }
      }
      
      // Se não encontrou no externalReference, tentar na descrição
      if (tier === 'lite' && payment.description) {
        const tierMatch = payment.description.match(/Plano\s+(LITE|PRO|PLUS)/i)
        if (tierMatch) {
          tier = tierMatch[1].toLowerCase()
        }
      }
      
      console.log(`📊 Tier identificado: ${tier} para pagamento ${paymentId}`)

      // Verificar se a transação existe
      const { data: transaction } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', paymentId)
        .single()

      if (!transaction) {
        // Criar transação
        await supabase.from('transactions').insert({
          id: paymentId,
          user_id: user.id,
          subscription_tier: tier,
          amount_brute: payment.value,
          amount_liquid: payment.netValue || payment.value,
          amount_fees: payment.value - (payment.netValue || payment.value),
          payment_method: `asaas_${payment.billingType?.toLowerCase() || 'pix'}`,
          status: isPaymentConfirmed ? 'paid' : 'pending'
        })
      } else {
        // Atualizar transação
        await supabase
          .from('transactions')
          .update({
            status: isPaymentConfirmed ? 'paid' : transaction.status,
            amount_liquid: payment.netValue || payment.value,
            amount_fees: payment.value - (payment.netValue || payment.value),
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId)
      }

      // Se confirmado ou recebido, ativar premium e criar/renovar assinatura
      // RECEIVED também deve ativar, pois significa que o PIX foi recebido
      if (isPaymentConfirmed) {
        const statusLabel = payment.status === 'CONFIRMED' ? 'confirmado' : 'recebido'
        console.log(`✅ Pagamento ${paymentId} ${statusLabel}! Criando/renovando assinatura...`)

        // Ativar premium
        const { error: premiumError } = await supabase
          .from('profiles')
          .update({
            is_premium: true,
            subscription_tier: tier
          })
          .eq('id', user.id)

        if (premiumError) {
          console.error('❌ Erro ao ativar premium:', premiumError)
        } else {
          console.log(`✅ Premium ativado para usuário ${user.id}`)
        }

        // Criar ou renovar assinatura própria (30 dias a partir de hoje)
        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setDate(periodEnd.getDate() + 30) // 30 dias a partir de hoje

        console.log(`📅 Criando/renovando assinatura: início ${now.toISOString().split('T')[0]}, vencimento ${periodEnd.toISOString().split('T')[0]}`)

        // Verificar se já existe uma assinatura ativa
        const { data: existingSubscription, error: checkError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (checkError) {
          console.error('❌ Erro ao verificar assinatura existente:', checkError)
        }

        if (existingSubscription) {
          // Renovar assinatura existente
          console.log(`🔄 Renovando assinatura ${existingSubscription.id} até ${periodEnd.toISOString().split('T')[0]}`)
          const { data: renewedSubscription, error: renewError } = await supabase
            .from('subscriptions')
            .update({
              tier: tier,
              status: 'active',
              amount: payment.value,
              current_period_start: now.toISOString().split('T')[0],
              current_period_end: periodEnd.toISOString().split('T')[0],
              last_payment_id: paymentId,
              payment_method: payment.billingType,
              auto_renew: true,
              canceled_at: null,
              expires_at: null
            })
            .eq('id', existingSubscription.id)
            .select()
            .single()

          if (renewError) {
            console.error('❌ Erro ao renovar assinatura:', {
              error: renewError,
              code: renewError.code,
              message: renewError.message,
              details: renewError.details,
              hint: renewError.hint
            })
            throw new Error(`Erro ao renovar assinatura: ${renewError.message}`)
          } else {
            console.log(`✅ Assinatura renovada com sucesso:`, renewedSubscription)
            
            // Enviar email de confirmação
            try {
              const { sendPaymentConfirmationEmail, sendSubscriptionConfirmationEmail } = await import('@/lib/email/sender')
              
              await sendPaymentConfirmationEmail(
                user.email!,
                profile.full_name || 'Usuário',
                payment.value,
                payment.billingType || 'PIX',
                paymentId
              )
              
              await sendSubscriptionConfirmationEmail(
                user.email!,
                profile.full_name || 'Usuário',
                tier.toUpperCase(),
                payment.value,
                'monthly'
              )
            } catch (emailError) {
              console.error('Erro ao enviar emails de confirmação:', emailError)
            }
          }
        } else {
          // Criar nova assinatura
          console.log(`📝 Criando nova assinatura para usuário ${user.id}`)
          const subscriptionData = {
            user_id: user.id,
            tier: tier,
            status: 'active',
            amount: payment.value,
            billing_cycle: 'monthly',
            start_date: now.toISOString().split('T')[0],
            current_period_start: now.toISOString().split('T')[0],
            current_period_end: periodEnd.toISOString().split('T')[0],
            last_payment_id: paymentId,
            asaas_customer_id: profile.asaas_customer_id,
            payment_method: payment.billingType,
            auto_renew: true
          }
          
          console.log(`📦 Dados da assinatura a ser criada:`, subscriptionData)
          
          const { data: newSubscription, error: createError } = await supabase
            .from('subscriptions')
            .insert(subscriptionData)
            .select()
            .single()

          if (createError) {
            console.error('❌ Erro ao criar assinatura:', {
              error: createError,
              code: createError.code,
              message: createError.message,
              details: createError.details,
              hint: createError.hint,
              subscriptionData
            })
            throw new Error(`Erro ao criar assinatura: ${createError.message}`)
          } else {
            console.log(`✅ Nova assinatura criada com sucesso:`, newSubscription)
            console.log(`✅ Assinatura válida até ${periodEnd.toISOString().split('T')[0]} (30 dias)`)
            
            // Enviar email de confirmação
            try {
              const { sendPaymentConfirmationEmail, sendSubscriptionConfirmationEmail } = await import('@/lib/email/sender')
              
              await sendPaymentConfirmationEmail(
                user.email!,
                profile.full_name || 'Usuário',
                payment.value,
                payment.billingType || 'PIX',
                paymentId
              )
              
              await sendSubscriptionConfirmationEmail(
                user.email!,
                profile.full_name || 'Usuário',
                tier.toUpperCase(),
                payment.value,
                'monthly'
              )
            } catch (emailError) {
              console.error('Erro ao enviar emails de confirmação:', emailError)
            }
          }
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Pagamento confirmado! Premium ativado e assinatura criada/renovada.',
          payment,
          premiumActivated: true
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Pagamento recebido, aguardando confirmação.',
        payment,
        premiumActivated: false
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Status do pagamento: ${payment.status}`,
      payment,
      premiumActivated: false
    })

  } catch (error: any) {
    console.error('Erro ao verificar pagamento:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar pagamento' 
    }, { status: 500 })
  }
}


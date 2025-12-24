import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

/**
 * Endpoint para verificar assinaturas vencidas e:
 * 1. Bloquear usuários com assinatura vencida
 * 2. Gerar nova cobrança se auto_renew = true
 * 
 * Este endpoint deve ser chamado periodicamente (cron job)
 * GET /api/admin/subscriptions/check-expired
 */
export async function GET(request: NextRequest) {
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

    const today = new Date().toISOString().split('T')[0]
    
    // Buscar assinaturas vencidas que ainda estão ativas
    const { data: expiredSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*, profiles(email, full_name, asaas_customer_id, cpf_cnpj)')
      .eq('status', 'active')
      .lt('current_period_end', today)

    if (fetchError) {
      throw fetchError
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhuma assinatura vencida encontrada',
        processed: 0
      })
    }

    const results = {
      blocked: 0,
      renewed: 0,
      errors: [] as string[]
    }

    // Processar cada assinatura vencida
    for (const subscription of expiredSubscriptions) {
      try {
        // 1. Bloquear usuário (remover premium)
        const { error: blockError } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_tier: null
          })
          .eq('id', subscription.user_id)

        if (blockError) {
          results.errors.push(`Erro ao bloquear usuário ${subscription.user_id}: ${blockError.message}`)
          continue
        }

        results.blocked++

        // 2. Se auto_renew = true, gerar nova cobrança
        if (subscription.auto_renew && subscription.asaas_customer_id) {
          try {
            // Calcular data de vencimento (30 dias a partir de hoje)
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 30)

            // Criar nova cobrança no Asaas
            const payment = await asaas.createPayment({
              customerId: subscription.asaas_customer_id,
              amount: subscription.amount,
              billingType: subscription.payment_method || 'PIX', // Usar o mesmo método do último pagamento
              description: `Renovação Assinatura BrasilPSD - Plano ${subscription.tier.toUpperCase()}`,
              dueDate: dueDate.toISOString().split('T')[0],
              externalReference: `${subscription.tier}_${subscription.user_id}`
            })

            // Atualizar assinatura para "suspended" (aguardando pagamento)
            await supabase
              .from('subscriptions')
              .update({
                status: 'suspended',
                last_payment_id: payment.paymentId || payment.id
              })
              .eq('id', subscription.id)

            results.renewed++
            console.log(`✅ Nova cobrança gerada para assinatura ${subscription.id}: ${payment.paymentId || payment.id}`)
          } catch (renewError: any) {
            results.errors.push(`Erro ao gerar nova cobrança para assinatura ${subscription.id}: ${renewError.message}`)
            
            // Se não conseguiu gerar cobrança, marcar como expirada
            await supabase
              .from('subscriptions')
              .update({
                status: 'expired'
              })
              .eq('id', subscription.id)
          }
        } else {
          // Se não tem auto_renew, apenas marcar como expirada
          await supabase
            .from('subscriptions')
            .update({
              status: 'expired'
            })
            .eq('id', subscription.id)
        }
      } catch (error: any) {
        results.errors.push(`Erro ao processar assinatura ${subscription.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      message: `Processadas ${expiredSubscriptions.length} assinaturas vencidas`,
      processed: expiredSubscriptions.length,
      blocked: results.blocked,
      renewed: results.renewed,
      errors: results.errors
    })
  } catch (error: any) {
    console.error('Erro ao verificar assinaturas vencidas:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar assinaturas vencidas' 
    }, { status: 500 })
  }
}


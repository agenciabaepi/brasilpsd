import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

export const dynamic = 'force-dynamic'

/**
 * Endpoint público para cron job do Vercel
 * Verifica assinaturas vencidas e bloqueia usuários automaticamente
 * 
 * Protegido por header Authorization com token secreto
 * Configurar no Vercel: CRON_SECRET_TOKEN
 * 
 * GET /api/cron/check-expired-subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar token de autenticação do cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET_TOKEN || 'default-secret-change-in-production'
    
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Tentativa de acesso não autorizado ao cron job')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = createRouteHandlerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    
    console.log(`🔍 Verificando assinaturas vencidas em ${today}...`)
    
    // Buscar TODAS as assinaturas ativas primeiro
    const { data: allActiveSubscriptions, error: fetchAllError } = await supabase
      .from('subscriptions')
      .select('*, profiles(email, full_name, asaas_customer_id, cpf_cnpj)')
      .eq('status', 'active')

    if (fetchAllError) {
      console.error('❌ Erro ao buscar assinaturas ativas:', fetchAllError)
      throw fetchAllError
    }

    console.log(`📋 Total de assinaturas ativas encontradas: ${allActiveSubscriptions?.length || 0}`)

    // Filtrar manualmente as expiradas (comparação de strings de data)
    const expiredSubscriptions = (allActiveSubscriptions || []).filter(sub => {
      const periodEnd = sub.current_period_end
      const isExpired = periodEnd < today
      
      if (isExpired) {
        console.log(`  ⚠️ Assinatura expirada encontrada: ${sub.id} (period_end: ${periodEnd}, hoje: ${today})`)
      }
      
      return isExpired
    })

    if (fetchError) {
      console.error('❌ Erro ao buscar assinaturas vencidas:', fetchError)
      throw fetchError
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      console.log('✅ Nenhuma assinatura vencida encontrada')
      return NextResponse.json({ 
        message: 'Nenhuma assinatura vencida encontrada',
        processed: 0,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`📋 Encontradas ${expiredSubscriptions.length} assinaturas vencidas`)

    const results = {
      blocked: 0,
      renewed: 0,
      errors: [] as string[]
    }

    // Processar cada assinatura vencida
    for (const subscription of expiredSubscriptions) {
      try {
        console.log(`🔄 Processando assinatura vencida: ${subscription.id} (usuário: ${subscription.user_id})`)
        
        // 1. Bloquear usuário (remover premium)
        const { error: blockError } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_tier: null
          })
          .eq('id', subscription.user_id)

        if (blockError) {
          const errorMsg = `Erro ao bloquear usuário ${subscription.user_id}: ${blockError.message}`
          results.errors.push(errorMsg)
          console.error(`❌ ${errorMsg}`)
          continue
        }

        results.blocked++
        console.log(`✅ Usuário ${subscription.user_id} bloqueado (premium removido)`)

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
              billingType: subscription.payment_method || 'PIX',
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
            const errorMsg = `Erro ao gerar nova cobrança para assinatura ${subscription.id}: ${renewError.message}`
            results.errors.push(errorMsg)
            console.error(`❌ ${errorMsg}`)
            
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
          
          console.log(`✅ Assinatura ${subscription.id} marcada como expirada`)
        }
      } catch (error: any) {
        const errorMsg = `Erro ao processar assinatura ${subscription.id}: ${error.message}`
        results.errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    const response = {
      message: `Processadas ${expiredSubscriptions.length} assinaturas vencidas`,
      processed: expiredSubscriptions.length,
      blocked: results.blocked,
      renewed: results.renewed,
      errors: results.errors,
      timestamp: new Date().toISOString()
    }

    console.log(`✅ Cron job concluído:`, response)
    
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('❌ Erro no cron job de verificação de assinaturas:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar assinaturas vencidas',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}


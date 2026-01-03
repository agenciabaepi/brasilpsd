import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { sendSubscriptionExpiringEmail } from '@/lib/email/sender'

export const dynamic = 'force-dynamic'

/**
 * Verifica assinaturas que expiram em 1 dia e envia emails de aviso
 * GET /api/cron/check-subscriptions-expiring
 * 
 * Esta rota deve ser chamada diariamente por um cron job (Vercel Cron ou similar)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se é chamada autorizada (cron job ou admin)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Se tiver CRON_SECRET configurado, verificar
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Se não tiver secret, verificar se é admin (para testes manuais)
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
    }

    const supabase = createRouteHandlerSupabaseClient()

    // Calcular data de amanhã (início e fim do dia)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const tomorrowStart = tomorrow.toISOString()
    
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)
    const tomorrowEndStr = tomorrowEnd.toISOString()

    // Buscar assinaturas que expiram amanhã e estão ativas
    // current_period_end é um timestamp, então precisamos verificar se está entre o início e fim de amanhã
    const { data: expiringSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        user:profiles!user_id(email, full_name)
      `)
      .eq('status', 'active')
      .gte('current_period_end', tomorrowStart)
      .lte('current_period_end', tomorrowEndStr)

    if (fetchError) {
      console.error('Erro ao buscar assinaturas expirando:', fetchError)
      return NextResponse.json({ 
        error: 'Erro ao buscar assinaturas',
        details: fetchError.message 
      }, { status: 500 })
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhuma assinatura expirando amanhã',
        processed: 0
      })
    }

    const results = {
      sent: 0,
      errors: [] as string[]
    }

    // Enviar email para cada assinatura expirando
    for (const subscription of expiringSubscriptions) {
      try {
        if (!subscription.user || !subscription.user.email) {
          results.errors.push(`Usuário não encontrado para assinatura ${subscription.id}`)
          continue
        }

        // Formatar data de expiração
        const expirationDate = new Date(subscription.current_period_end)
        const formattedDate = expirationDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })

        // Enviar email
        await sendSubscriptionExpiringEmail(
          subscription.user.email,
          subscription.user.full_name || 'Usuário',
          subscription.tier || 'Premium',
          formattedDate
        )

        results.sent++
        console.log(`✅ Email de aviso enviado para: ${subscription.user.email}`)
      } catch (emailError: any) {
        const errorMsg = `Erro ao enviar email para assinatura ${subscription.id}: ${emailError.message}`
        results.errors.push(errorMsg)
        console.error('❌', errorMsg)
      }
    }

    return NextResponse.json({
      message: `Processadas ${expiringSubscriptions.length} assinaturas expirando`,
      processed: expiringSubscriptions.length,
      emailsSent: results.sent,
      errors: results.errors
    })
  } catch (error: any) {
    console.error('Erro ao verificar assinaturas expirando:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar assinaturas expirando' 
    }, { status: 500 })
  }
}


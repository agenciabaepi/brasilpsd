import { createSupabaseClient } from '@/lib/supabase/client'

/**
 * Verifica se a assinatura do usuário expirou e atualiza o perfil se necessário
 * 
 * @param userId - ID do usuário
 * @param supabase - Cliente Supabase (client-side)
 * @returns true se a assinatura está ativa, false se expirou
 */
export async function checkAndUpdateSubscriptionStatus(
  userId: string,
  supabase: any
): Promise<{ isActive: boolean; subscription: any | null }> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Buscar todas as assinaturas ativas do usuário
    const { data: allActiveSubscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id, tier, status, current_period_end, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (subError) {
      console.error('❌ Erro ao buscar assinaturas:', subError)
      return { isActive: false, subscription: null }
    }

    if (!allActiveSubscriptions || allActiveSubscriptions.length === 0) {
      // Não tem assinatura ativa, garantir que premium está desativado
      await supabase
        .from('profiles')
        .update({
          is_premium: false,
          subscription_tier: null
        })
        .eq('id', userId)
      
      return { isActive: false, subscription: null }
    }

    // Verificar se alguma assinatura está expirada
    let activeSubscription = null
    let expiredSubscription = null

    for (const sub of allActiveSubscriptions) {
      const periodEnd = sub.current_period_end
      
      // Normalizar a data
      let periodEndDate: string | null = null
      if (periodEnd === null || periodEnd === undefined) {
        expiredSubscription = sub
        continue
      } else if (typeof periodEnd === 'string') {
        periodEndDate = periodEnd.split('T')[0].trim()
      } else if (periodEnd instanceof Date) {
        periodEndDate = periodEnd.toISOString().split('T')[0]
      } else {
        periodEndDate = String(periodEnd).split('T')[0].trim()
      }
      
      if (!periodEndDate) {
        expiredSubscription = sub
        continue
      }
      
      // Comparação de strings no formato YYYY-MM-DD
      const isExpired = periodEndDate < today
      
      if (isExpired) {
        expiredSubscription = sub
      } else {
        if (!activeSubscription) {
          activeSubscription = sub
        }
      }
    }

    // Se encontrou assinatura expirada, bloquear usuário
    if (expiredSubscription) {
      console.warn('⚠️ Assinatura expirada detectada, bloqueando usuário:', {
        userId,
        subscriptionId: expiredSubscription.id,
        expiredDate: expiredSubscription.current_period_end,
        today
      })

      // Bloquear usuário
      await supabase
        .from('profiles')
        .update({
          is_premium: false,
          subscription_tier: null
        })
        .eq('id', userId)

      // Marcar assinatura como expirada
      await supabase
        .from('subscriptions')
        .update({
          status: 'expired'
        })
        .eq('id', expiredSubscription.id)

      return { isActive: false, subscription: null }
    }

    // Se tem assinatura ativa, garantir que premium está ativado
    if (activeSubscription) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, subscription_tier')
        .eq('id', userId)
        .single()

      // Se o perfil não está marcado como premium ou o tier está errado, atualizar
      if (!profile?.is_premium || profile?.subscription_tier !== activeSubscription.tier) {
        await supabase
          .from('profiles')
          .update({
            is_premium: true,
            subscription_tier: activeSubscription.tier
          })
          .eq('id', userId)
      }

      return { isActive: true, subscription: activeSubscription }
    }

    // Se não tem assinatura ativa, garantir que premium está desativado
    await supabase
      .from('profiles')
      .update({
        is_premium: false,
        subscription_tier: null
      })
      .eq('id', userId)

    return { isActive: false, subscription: null }
  } catch (error: any) {
    console.error('❌ Erro ao verificar status da assinatura:', error)
    return { isActive: false, subscription: null }
  }
}

/**
 * Versão client-side (usa createSupabaseClient)
 * Pode ser usada tanto no client quanto no server (com createServerSupabaseClient passado como parâmetro)
 */
export async function checkAndUpdateSubscriptionStatusClient(userId: string, supabaseClient?: any) {
  const supabase = supabaseClient || createSupabaseClient()
  return checkAndUpdateSubscriptionStatus(userId, supabase)
}


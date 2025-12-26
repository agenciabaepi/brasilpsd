import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Interface para o status de downloads do usuário
 */
export interface DownloadStatus {
  current: number
  limit: number
  remaining: number
  plan: string
  allowed: boolean
}

/**
 * Obtém o status de downloads do usuário
 * 
 * Esta função chama a função SQL `get_user_download_status` que:
 * - Conta downloads do dia atual (timezone America/Sao_Paulo)
 * - Obtém o limite baseado no plano do usuário
 * - Calcula downloads restantes
 * - Verifica se está permitido fazer download
 * 
 * @param userId - ID do usuário
 * @returns Status de downloads ou null em caso de erro
 * 
 * @example
 * ```ts
 * const status = await getDownloadStatus(userId)
 * if (status) {
 *   console.log(`${status.current} / ${status.limit} downloads hoje`)
 *   console.log(`${status.remaining} downloads restantes`)
 * }
 * ```
 */
export async function getDownloadStatus(
  userId: string
): Promise<DownloadStatus | null> {
  try {
    const supabase = createServerSupabaseClient()

    // Obter perfil do usuário para pegar o tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error getting profile:', profileError)
      return null
    }

    const tier = profile?.subscription_tier || 'free'
    const limit = getDownloadLimitByPlan(tier)

    // Contar downloads de hoje diretamente usando o Supabase client
    // Buscar todos os downloads do usuário
    const { data: allDownloads, error: allError } = await supabase
      .from('downloads')
      .select('created_at')
      .eq('user_id', userId)

    let current = 0
    if (!allError && allDownloads && allDownloads.length > 0) {
      // Obter data atual no timezone do Brasil usando uma abordagem mais confiável
      const now = new Date()
      // Criar uma data no timezone do Brasil
      const brasilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const todayYear = brasilDate.getFullYear()
      const todayMonth = String(brasilDate.getMonth() + 1).padStart(2, '0')
      const todayDay = String(brasilDate.getDate()).padStart(2, '0')
      const today = `${todayYear}-${todayMonth}-${todayDay}`

      // Filtrar downloads de hoje
      current = allDownloads.filter(d => {
        if (!d.created_at) return false
        
        // Converter created_at (UTC) para timezone do Brasil
        const downloadDate = new Date(d.created_at)
        const brasilDownloadDate = new Date(downloadDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const downloadYear = brasilDownloadDate.getFullYear()
        const downloadMonth = String(brasilDownloadDate.getMonth() + 1).padStart(2, '0')
        const downloadDay = String(brasilDownloadDate.getDate()).padStart(2, '0')
        const downloadDayStr = `${downloadYear}-${downloadMonth}-${downloadDay}`
        
        return downloadDayStr === today
      }).length
      
      console.log('📊 Download count:', {
        total: allDownloads.length,
        today,
        current,
        userId,
        sampleDates: allDownloads.slice(0, 5).map(d => {
          const dDate = new Date(d.created_at)
          const brasilD = new Date(dDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
          return {
            utc: d.created_at,
            brasil: `${brasilD.getFullYear()}-${String(brasilD.getMonth() + 1).padStart(2, '0')}-${String(brasilD.getDate()).padStart(2, '0')}`,
            isToday: `${brasilD.getFullYear()}-${String(brasilD.getMonth() + 1).padStart(2, '0')}-${String(brasilD.getDate()).padStart(2, '0')}` === today
          }
        })
      })
    } else if (allError) {
      console.error('❌ Error fetching downloads:', allError)
    } else {
      console.log('⚠️ No downloads found for user:', userId)
    }

    const remaining = Math.max(0, limit - current)
    const allowed = current < limit

    return {
      current,
      limit,
      remaining,
      plan: tier,
      allowed
    }
  } catch (error) {
    console.error('Unexpected error in getDownloadStatus:', error)
    return null
  }
}

/**
 * Verifica se o usuário pode fazer download
 * 
 * @param userId - ID do usuário
 * @returns true se pode fazer download, false caso contrário
 */
export async function canDownload(userId: string): Promise<boolean> {
  const status = await getDownloadStatus(userId)
  return status?.allowed || false
}

/**
 * Obtém apenas a contagem de downloads do dia atual
 * 
 * @param userId - ID do usuário
 * @returns Número de downloads feitos hoje
 */
export async function getTodayDownloadCount(userId: string): Promise<number> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.rpc('count_user_downloads_today', {
      p_user_id: userId
    })

    if (error) {
      console.error('Error counting downloads today:', error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error('Unexpected error in getTodayDownloadCount:', error)
    return 0
  }
}

/**
 * Obtém o limite de downloads baseado no plano
 * 
 * @param plan - Nome do plano (free, lite, pro, plus)
 * @returns Limite de downloads por dia
 */
export function getDownloadLimitByPlan(plan: string | null | undefined): number {
  const normalizedPlan = (plan || 'free').toLowerCase()
  
  switch (normalizedPlan) {
    case 'lite':
      return 3
    case 'pro':
      return 10
    case 'plus':
      return 20
    case 'ultra':
      return 20
    case 'free':
    default:
      return 1
  }
}

/**
 * Formata o status de downloads para exibição
 * 
 * @param status - Status de downloads
 * @returns String formatada (ex: "2 / 10 downloads hoje")
 */
export function formatDownloadStatus(status: DownloadStatus | null): string {
  if (!status) {
    return '0 / 0 downloads hoje'
  }

  return `${status.current} / ${status.limit} downloads hoje`
}

/**
 * Formata o plano para exibição
 * 
 * @param plan - Nome do plano
 * @returns Nome formatado do plano
 */
export function formatPlanName(plan: string | null | undefined): string {
  const normalizedPlan = (plan || 'free').toLowerCase()
  
  const planNames: Record<string, string> = {
    free: 'Grátis',
    lite: 'Lite',
    pro: 'Pro',
    plus: 'Plus',
    ultra: 'Ultra'
  }

  return planNames[normalizedPlan] || 'Grátis'
}


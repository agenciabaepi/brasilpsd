import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDownloadLimitByPlan } from './download-helpers'

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

    // Contar recursos ÚNICOS baixados hoje usando a função SQL
    // Isso garante que múltiplos downloads do mesmo recurso contem apenas como 1
    let current = 0
    
    // Primeiro, tentar usar a nova função (se a migration foi aplicada)
    const { data: uniqueCount, error: countError } = await supabase
      .rpc('count_unique_resources_downloaded_today', {
        p_user_id: userId
      })

    if (!countError && uniqueCount !== null && uniqueCount !== undefined) {
      current = uniqueCount
      console.log('📊 Unique resources downloaded today (new function):', {
        userId,
        current,
        limit
      })
    } else {
      // Se a função nova não existe ou deu erro, usar fallback
      console.warn('⚠️ New function not available, using fallback:', countError?.message)
      
      // Fallback: contar diretamente usando DISTINCT na query
      const { data: downloadsData, error: downloadsError } = await supabase
        .from('downloads')
        .select('resource_id, created_at, downloaded_at')
        .eq('user_id', userId)
      
      if (!downloadsError && downloadsData) {
        // Obter data atual no timezone do Brasil
        const now = new Date()
        const brasilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const todayYear = brasilDate.getFullYear()
        const todayMonth = String(brasilDate.getMonth() + 1).padStart(2, '0')
        const todayDay = String(brasilDate.getDate()).padStart(2, '0')
        const today = `${todayYear}-${todayMonth}-${todayDay}`

        // Filtrar downloads de hoje e contar recursos únicos
        const uniqueResources = new Set<string>()
        downloadsData.forEach(d => {
          const downloadDate = d.created_at || d.downloaded_at
          if (!downloadDate) return
          
          const downloadDateObj = new Date(downloadDate)
          const brasilDownloadDate = new Date(downloadDateObj.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
          const downloadYear = brasilDownloadDate.getFullYear()
          const downloadMonth = String(brasilDownloadDate.getMonth() + 1).padStart(2, '0')
          const downloadDay = String(brasilDownloadDate.getDate()).padStart(2, '0')
          const downloadDayStr = `${downloadYear}-${downloadMonth}-${downloadDay}`
          
          if (downloadDayStr === today && d.resource_id) {
            uniqueResources.add(d.resource_id)
          }
        })
        
        current = uniqueResources.size
        console.log('📊 Unique resources downloaded today (fallback):', {
          userId,
          current,
          limit,
          uniqueResources: Array.from(uniqueResources)
        })
      } else {
        console.error('❌ Error fetching downloads for fallback:', downloadsError)
      }
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

// Re-exportar funções puras do arquivo de helpers (para compatibilidade)
export { getDownloadLimitByPlan, formatPlanName } from './download-helpers'

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



import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/aws/s3'
import { checkDownloadRateLimit, getClientIP } from '@/lib/utils/rate-limit'
import { getCache, setCache, deleteCacheByPrefix, getDownloadStatusCacheKey, DOWNLOAD_STATUS_CACHE_TTL } from '@/lib/utils/cache'

export const dynamic = 'force-dynamic'

/**
 * API de Download Segura
 * 
 * Validações implementadas:
 * 1. Autenticação do usuário
 * 2. Verificação de plano ativo
 * 3. Verificação de limite de downloads
 * 4. Validação de recurso aprovado
 * 5. Registro de download com auditoria (IP, User Agent)
 * 6. Geração de URL assinada apenas após todas as validações
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ========================================================================
    // 0. RATE LIMITING (antes de qualquer processamento)
    // ========================================================================
    const ipAddress = getClientIP(request)
    const rateLimitResult = checkDownloadRateLimit(ipAddress)
    
    if (!rateLimitResult.allowed) {
      console.warn('⚠️ Download blocked: Rate limit exceeded', {
        ip: ipAddress,
        retryAfter: rateLimitResult.retryAfter
      })
      
      return NextResponse.json(
        {
          error: 'Muitas requisições',
          message: `Você fez muitas requisições. Tente novamente em ${rateLimitResult.retryAfter} segundos.`,
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
    }

    // ========================================================================
    // 1. AUTENTICAÇÃO
    // ========================================================================
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('❌ Download failed: Unauthorized', { error: authError })
      return NextResponse.json(
        { 
          error: 'Não autorizado',
          message: 'Você precisa fazer login para baixar recursos. Por favor, faça login e tente novamente.'
        },
        { status: 401 }
      )
    }

    // ========================================================================
    // 2. OBTER PARÂMETROS E DADOS DE AUDITORIA
    // ========================================================================
    const { resourceId, key } = await request.json()

    if (!resourceId || !key) {
      return NextResponse.json(
        { 
          error: 'Parâmetros inválidos',
          message: 'Os parâmetros resourceId e key são obrigatórios. Verifique se você está enviando todos os dados necessários.'
        },
        { status: 400 }
      )
    }

    // User Agent para auditoria
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // ========================================================================
    // 3. BUSCAR PERFIL E RECURSO EM PARALELO (otimização de performance)
    // ========================================================================
    const [profileResult, resourceResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('subscription_tier, is_admin, is_creator')
        .eq('id', user.id)
        .single(),
      supabase
        .from('resources')
        .select('id, status, creator_id, file_url, is_premium')
        .eq('id', resourceId)
        .single()
    ])

    const { data: profile, error: profileError } = profileResult
    const { data: resource, error: resourceError } = resourceResult


    // Verificar assinatura ativa (status='active' E current_period_end >= hoje)
    // Usar data no timezone do Brasil para comparação correta
    const now = new Date()
    const todayBR = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const today = todayBR.toISOString().split('T')[0] // Formato: YYYY-MM-DD
    
    // Buscar TODAS as assinaturas ativas do usuário (sem filtro de data)
    const { data: allActiveSubscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id, tier, status, current_period_end, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (subError) {
      console.error('❌ Erro ao buscar assinaturas:', subError)
      return NextResponse.json(
        { error: 'Erro ao verificar assinatura', message: subError.message },
        { status: 500 }
      )
    }

    // Verificar se alguma assinatura está expirada
    let activeSubscription = null
    let expiredSubscription = null

    if (allActiveSubscriptions && allActiveSubscriptions.length > 0) {
      for (const sub of allActiveSubscriptions) {
        const periodEnd = sub.current_period_end
        
        // Normalizar a data (pode vir como string ou Date)
        let periodEndDate: string | null = null
        if (periodEnd === null || periodEnd === undefined) {
          // Se é null ou undefined, considerar expirada
          console.warn(`⚠️ Assinatura ${sub.id} sem current_period_end`)
          expiredSubscription = sub
          continue
        } else if (typeof periodEnd === 'string') {
          // Se já é string, usar diretamente (formato YYYY-MM-DD)
          periodEndDate = periodEnd.split('T')[0].trim() // Remove hora se houver e espaços
        } else if (periodEnd instanceof Date) {
          // Se é Date, converter para string
          periodEndDate = periodEnd.toISOString().split('T')[0]
        } else {
          // Tentar converter para string
          periodEndDate = String(periodEnd).split('T')[0].trim()
        }
        
        if (!periodEndDate) {
          console.warn(`⚠️ Assinatura ${sub.id} com current_period_end inválido:`, periodEnd)
          expiredSubscription = sub
          continue
        }
        
        // Comparação de strings no formato YYYY-MM-DD (funciona corretamente)
        // Exemplo: "2025-12-22" < "2025-12-25" = true (expirada)
        const isExpired = periodEndDate < today
        
        if (isExpired) {
          expiredSubscription = sub
        } else {
          // Se não está expirada, usar como ativa
          if (!activeSubscription) {
            activeSubscription = sub
          }
        }
      }
    }

    // Se encontrou assinatura expirada, bloquear imediatamente
    if (expiredSubscription) {
      console.warn('⚠️ Assinatura expirada detectada, bloqueando usuário:', {
        userId: user.id,
        subscriptionId: expiredSubscription.id,
        expiredDate: expiredSubscription.current_period_end,
        today: today
      })

      // Bloquear usuário
      const { error: blockError } = await supabase
        .from('profiles')
        .update({
          is_premium: false,
          subscription_tier: null
        })
        .eq('id', user.id)

      if (blockError) {
        console.error('❌ Erro ao bloquear usuário:', blockError)
      }

      // Marcar assinatura como expirada
      const { error: expireError } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired'
        })
        .eq('id', expiredSubscription.id)

      if (expireError) {
        console.error('❌ Erro ao marcar assinatura como expirada:', expireError)
      }

      return NextResponse.json(
        {
          error: 'Assinatura expirada',
          message: 'Sua assinatura expirou. Renove sua assinatura para continuar baixando recursos.',
          suggestion: 'Acesse /premium para renovar sua assinatura.',
          expiredDate: expiredSubscription.current_period_end,
          today: today
        },
        { status: 403 }
      )
    }

    // ========================================================================
    // 4. VERIFICAR SE RECURSO EXISTE E ESTÁ APROVADO
    // ========================================================================
    // Recurso já foi buscado em paralelo acima, apenas verificar se está aprovado

    // Verificar se recurso está aprovado OU se é o criador/admin
    const isCreator = resource.creator_id === user.id
    const isAdmin = profile.is_admin

    if (resource.status !== 'approved' && !isCreator && !isAdmin) {
      console.warn('⚠️ Download blocked: Resource not approved', {
        userId: user.id,
        resourceId,
        status: resource.status
      })
      
      const statusMessages: Record<string, string> = {
        pending: 'Este recurso ainda está aguardando aprovação e não está disponível para download.',
        rejected: 'Este recurso foi rejeitado e não está disponível para download.',
        draft: 'Este recurso ainda está em rascunho e não está disponível para download.'
      }
      
      return NextResponse.json(
        { 
          error: 'Recurso não disponível',
          message: statusMessages[resource.status] || 'Este recurso não está disponível para download no momento.'
        },
        { status: 403 }
      )
    }

    // ========================================================================
    // 5. VERIFICAR ASSINATURA APENAS SE RECURSO FOR PREMIUM
    // ========================================================================
    // Se o recurso é premium, verificar assinatura
    if (resource.is_premium) {
      // Se não tem assinatura ativa, bloquear
      if (!activeSubscription) {
        console.warn('⚠️ Usuário sem assinatura ativa tentando baixar recurso premium:', user.id)
        return NextResponse.json(
          {
            error: 'Assinatura necessária',
            message: 'Este recurso é exclusivo para membros Premium. Você precisa de uma assinatura ativa para baixá-lo.',
            suggestion: 'Acesse /premium para assinar um plano.'
          },
          { status: 403 }
        )
      }

      console.log('✅ Assinatura ativa encontrada para recurso premium:', {
        subscriptionId: activeSubscription.id,
        tier: activeSubscription.tier,
        periodEnd: activeSubscription.current_period_end
      })
    } else {
      console.log('✅ Recurso gratuito, não requer assinatura')
    }

    // ========================================================================
    // 6. VERIFICAR LIMITE E GERAR URL ASSINADA EM PARALELO (otimização máxima)
    // ========================================================================
    // Fazer verificação de limite e geração de URL em paralelo para acelerar
    const [downloadStatusCheck, signedUrlPromise] = await Promise.allSettled([
      // Verificar limite de downloads
      (async () => {
        const { getDownloadStatus } = await import('@/lib/utils/downloads')
        return await getDownloadStatus(user.id)
      })(),
      // Gerar URL assinada em paralelo (não depende do limite)
      getSignedDownloadUrl(key, 3600) // 1 hora de validade
    ])

    // Processar verificação de limite
    let downloadStatusData: any = null
    if (downloadStatusCheck.status === 'fulfilled') {
      downloadStatusData = downloadStatusCheck.value
    } else {
      console.error('❌ Download failed: Could not get download status', { userId: user.id, error: downloadStatusCheck.reason })
      return NextResponse.json(
        { 
          error: 'Erro ao verificar limite de downloads',
          message: 'Não foi possível verificar seu limite de downloads. Por favor, tente novamente em alguns instantes.'
        },
        { status: 500 }
      )
    }

    if (!downloadStatusData) {
      console.error('❌ Download failed: Could not get download status', { userId: user.id })
      return NextResponse.json(
        { 
          error: 'Erro ao verificar limite de downloads',
          message: 'Não foi possível verificar seu limite de downloads. Por favor, tente novamente em alguns instantes.'
        },
        { status: 500 }
      )
    }

    // BLOQUEAR SE O LIMITE FOI ATINGIDO - CRÍTICO!
    if (!downloadStatusData.allowed) {
      console.warn('⚠️ Download BLOCKED: Limit exceeded', {
        userId: user.id,
        resourceId,
        current: downloadStatusData.current,
        limit: downloadStatusData.limit,
        remaining: downloadStatusData.remaining
      })
      
      // Mensagem mais amigável baseada no plano
      const planMessages: Record<string, string> = {
        free: 'Você atingiu seu limite diário de 1 download. Faça upgrade para baixar mais recursos!',
        lite: 'Você atingiu seu limite diário de 3 downloads. Faça upgrade para baixar mais recursos!',
        pro: 'Você atingiu seu limite diário de 10 downloads. Faça upgrade para baixar mais recursos!',
        plus: 'Você atingiu seu limite diário de 20 downloads. Tente novamente amanhã!',
      }

      const tier = activeSubscription?.tier || 'free'
      
      return NextResponse.json(
        {
          error: 'Limite de downloads excedido',
          message: planMessages[tier] || 'Você atingiu seu limite diário de downloads.',
          current_count: downloadStatusData.current,
          limit_count: downloadStatusData.limit,
          remaining: downloadStatusData.remaining
        },
        { status: 403 }
      )
    }

    // Processar URL assinada (já gerada em paralelo)
    let signedUrl: string
    if (signedUrlPromise.status === 'fulfilled') {
      signedUrl = signedUrlPromise.value
    } else {
      console.error('❌ Failed to generate signed URL:', signedUrlPromise.reason)
      return NextResponse.json(
        { error: 'Erro ao gerar URL de download' },
        { status: 500 }
      )
    }

    // ========================================================================
    // 7. REGISTRAR DOWNLOAD (URL já foi gerada acima em paralelo)
    // ========================================================================
    const rpcParams = {
      p_user_id: user.id,
      p_resource_id: resourceId,
      p_ip_address: ipAddress || null,
      p_user_agent: userAgent || null
    }

    const registerResult = await supabase.rpc('register_download', rpcParams)
    
    let downloadResult: any = null
    let registerError: any = null

    if (registerResult.error) {
      registerError = registerResult.error
      console.error('❌ Download registration failed:', registerError)
    } else {
      downloadResult = registerResult.data
    }

    if (registerError) {
      console.error('❌ Download failed: Error registering download', {
        userId: user.id,
        resourceId,
        error: registerError,
        message: registerError.message,
        code: registerError.code,
        details: registerError.details,
        hint: registerError.hint
      })
      
      // Verificar se é erro de limite excedido
      const errorMessage = registerError.message || registerError.details || registerError.hint || ''
      if (errorMessage.includes('Limite de downloads excedido') || 
          errorMessage.includes('excedido após validação') ||
          errorMessage.includes('limite')) {
        return NextResponse.json(
          {
            error: 'Limite de downloads excedido',
            message: errorMessage
          },
          { status: 403 }
        )
      }

      // Verificar se é erro de função não encontrada
      if (registerError.code === '42883' || // function does not exist
          registerError.message?.includes('does not exist') ||
          registerError.message?.includes('function') ||
          registerError.hint?.includes('function')) {
        console.error('❌ RPC function register_download does not exist!')
        console.error('   Please apply migrations 033, 034, and 035 in Supabase SQL Editor')
      }

      // Em desenvolvimento, retornar mais detalhes do erro
      const errorResponse: any = {
        error: 'Erro ao registrar download. Tente novamente.',
        message: registerError.message || 'Erro desconhecido'
      }

      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
          message: registerError.message,
          code: registerError.code,
          details: registerError.details,
          hint: registerError.hint,
          suggestion: 'Verifique se as migrations 033, 034 e 035 foram aplicadas no Supabase'
        }
      }

      return NextResponse.json(errorResponse, { status: 500 })
    }

    if (!downloadResult || downloadResult.length === 0) {
      console.error('❌ Download failed: No result from register_download', {
        userId: user.id,
        resourceId,
        downloadResult
      })
      return NextResponse.json(
        { error: 'Erro ao registrar download. Nenhum resultado retornado.' },
        { status: 500 }
      )
    }

    let result = downloadResult[0]

    if (!result.success) {
      // NOVA LÓGICA: Se o erro for sobre já ter baixado no mês, permitir o download mesmo assim
      // (a comissão não será gerada novamente, mas o usuário pode baixar)
      const errorMessage = result?.message || ''
      const isAlreadyDownloadedThisMonth = errorMessage.includes('já baixou este recurso neste mês') ||
                                            errorMessage.includes('pode ser baixado apenas uma vez por mês')
      
      if (isAlreadyDownloadedThisMonth) {
        console.log('ℹ️ User already downloaded this month, but allowing download (commission already generated)', {
          userId: user.id,
          resourceId,
          message: errorMessage
        })
        
        // Registrar o download manualmente (para histórico)
        // A comissão já foi gerada na primeira vez, então não precisa gerar novamente
        try {
          const { data: manualDownload, error: manualError } = await supabase
            .from('downloads')
            .insert({
              user_id: user.id,
              resource_id: resourceId,
              ip_address: ipAddress || null,
              user_agent: userAgent || null,
              downloaded_at: new Date().toISOString()
            })
            .select('id')
            .single()
          
          if (manualError && !manualError.message?.includes('duplicate')) {
            console.warn('⚠️ Error registering manual download (non-critical):', manualError)
          } else {
            console.log('✅ Manual download registered for history:', manualDownload?.id)
          }
        } catch (err) {
          console.warn('⚠️ Exception registering manual download (non-critical):', err)
        }
        
        // Continuar com o fluxo normal de download (não retornar erro)
        // IMPORTANTE: Buscar status atualizado do banco após registrar o download
        // para garantir que os valores estejam corretos
        try {
          const { getDownloadStatus } = await import('@/lib/utils/downloads')
          const updatedStatus = await getDownloadStatus(user.id)
          
          if (updatedStatus) {
            result = {
              success: true,
              download_id: manualDownload?.id || null,
              current_count: updatedStatus.current,
              limit_count: updatedStatus.limit,
              remaining: updatedStatus.remaining,
              is_new_download: false // Não conta como novo pois já foi baixado no mês
            }
            console.log('📊 Updated status after manual download registration:', result)
          } else {
            // Fallback para valores antigos se não conseguir atualizar
            result = {
              success: true,
              download_id: manualDownload?.id || null,
              current_count: downloadStatusData.current,
              limit_count: downloadStatusData.limit,
              remaining: downloadStatusData.remaining,
              is_new_download: false
            }
          }
        } catch (statusError) {
          console.error('❌ Error getting updated status:', statusError)
          // Fallback para valores antigos
          result = {
            success: true,
            download_id: manualDownload?.id || null,
            current_count: downloadStatusData.current,
            limit_count: downloadStatusData.limit,
            remaining: downloadStatusData.remaining,
            is_new_download: false
          }
        }
      } else {
        // Para outros erros (limite excedido, etc), bloquear normalmente
        console.warn('⚠️ Download blocked: Registration failed', {
          userId: user.id,
          resourceId,
          message: result?.message,
          result
        })
        
        return NextResponse.json(
          {
            error: result?.message || 'Não foi possível registrar o download',
            current_count: result?.current_count,
            limit_count: result?.limit_count,
            remaining: result?.remaining
          },
          { status: 403 }
        )
      }
    }

    // ========================================================================
    // 7. INVALIDAR CACHE (download foi registrado, status mudou)
    // ========================================================================
    // URL assinada já foi gerada em paralelo acima, não precisa gerar novamente
    deleteCacheByPrefix(`download_status:${user.id}`)
    deleteCacheByPrefix(`download_limit:${user.id}`)

    // ========================================================================
    // 9. PREPARAR RESPOSTA COM INFORMAÇÕES DO DOWNLOAD
    // ========================================================================
    const isNewDownload = result.is_new_download !== false // Default true se não especificado

    // ========================================================================
    // 9. VERIFICAR SE DOWNLOAD FOI REALMENTE REGISTRADO NO BANCO
    // ========================================================================
    // Verificação adicional: confirmar que o download foi inserido (apenas se tiver download_id)
    let verifyDownload = null
    if (result.download_id) {
      const { data: verifyData, error: verifyError } = await supabase
        .from('downloads')
        .select('id, created_at')
        .eq('id', result.download_id)
        .single()

      if (verifyError || !verifyData) {
        console.error('⚠️ WARNING: Download ID retornado mas não encontrado no banco!', {
          downloadId: result.download_id,
          error: verifyError
        })
      } else {
        verifyDownload = verifyData
        console.log('✅ Download confirmado no banco:', {
          downloadId: result.download_id,
          createdAt: verifyDownload.created_at
        })
      }
    } else {
      console.log('ℹ️ Download sem ID (já baixado no mês, mas permitido)')
    }

    // ========================================================================
    // 10. LOG DE AUDITORIA (sucesso)
    // ========================================================================
    const duration = Date.now() - startTime
    console.log('✅ Download authorized', {
      userId: user.id,
      resourceId,
      downloadId: result.download_id,
      ipAddress,
      userAgent: userAgent.substring(0, 100), // Limitar tamanho do log
      current_count: result.current_count,
      limit_count: result.limit_count,
      remaining: result.remaining,
      is_new_download: isNewDownload,
      duration: `${duration}ms`,
      verifiedInDb: !!verifyDownload
    })

    // ========================================================================
    // 11. RETORNAR SUCESSO
    // ========================================================================
    return NextResponse.json({
      url: signedUrl,
      download_id: result.download_id,
      current_count: result.current_count,
      limit_count: result.limit_count,
      remaining: result.remaining,
      is_new_download: isNewDownload,
      message: !isNewDownload
        ? 'Download permitido (recurso já baixado hoje, não conta como novo download)'
        : result.remaining === 0 
        ? 'Você atingiu seu limite diário de downloads.' 
        : result.remaining <= 2 
        ? `Atenção: Você tem apenas ${result.remaining} download${result.remaining > 1 ? 's' : ''} restante${result.remaining > 1 ? 's' : ''} hoje.`
        : undefined
    }, {
      headers: {
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      }
    })

  } catch (error: any) {
    // ========================================================================
    // TRATAMENTO DE ERROS
    // ========================================================================
    const duration = Date.now() - startTime
    console.error('❌ Download error:', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    })

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}


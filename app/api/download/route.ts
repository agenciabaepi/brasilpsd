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
    // 3. VERIFICAR PLANO ATIVO DO USUÁRIO
    // ========================================================================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, is_admin, is_creator')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Download failed: Profile not found', { userId: user.id, error: profileError })
      return NextResponse.json(
        { error: 'Perfil do usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar assinatura ativa (status='active' E current_period_end >= hoje)
    // Usar data no timezone do Brasil para comparação correta
    const now = new Date()
    const todayBR = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const today = todayBR.toISOString().split('T')[0] // Formato: YYYY-MM-DD
    
    console.log('🔍 Verificando assinatura para usuário:', user.id)
    console.log('📅 Data de hoje (BR):', today, 'Timestamp:', now.toISOString())
    
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

    console.log('📋 Assinaturas encontradas:', allActiveSubscriptions?.length || 0)
    if (allActiveSubscriptions && allActiveSubscriptions.length > 0) {
      allActiveSubscriptions.forEach(sub => {
        console.log(`  - Assinatura ${sub.id}: period_end="${sub.current_period_end}" (tipo: ${typeof sub.current_period_end})`)
      })
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
        
        // Log detalhado para debug
        console.log(`  📊 Comparação: "${periodEndDate}" < "${today}" = ${isExpired}`)
        
        console.log(`  - Assinatura ${sub.id}: period_end="${periodEndDate}", hoje="${today}", expirada=${isExpired}`)
        
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
    // 4. VERIFICAR SE RECURSO EXISTE E ESTÁ APROVADO (ANTES DE VERIFICAR ASSINATURA)
    // ========================================================================
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, status, creator_id, file_url, is_premium')
      .eq('id', resourceId)
      .single()

    if (resourceError || !resource) {
      console.error('❌ Download failed: Resource not found', { 
        resourceId, 
        error: resourceError 
      })
      return NextResponse.json(
        { 
          error: 'Recurso não encontrado',
          message: 'O recurso que você está tentando baixar não existe ou foi removido.'
        },
        { status: 404 }
      )
    }

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
    // 6. VERIFICAR LIMITE DE DOWNLOADS (usando função helper que conta corretamente)
    // ========================================================================
    console.log('🔍 Checking download limit for user:', user.id)
    
    // IMPORTANTE: Usar a função helper getDownloadStatus que conta diretamente
    // ao invés da RPC que não está funcionando corretamente
    const { getDownloadStatus } = await import('@/lib/utils/downloads')
    const downloadStatusData = await getDownloadStatus(user.id)
    
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

    console.log('✅ Download limit check result:', {
      userId: user.id,
      current: downloadStatusData.current,
      limit: downloadStatusData.limit,
      remaining: downloadStatusData.remaining,
      allowed: downloadStatusData.allowed
    })

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

    // ========================================================================
    // 7. REGISTRAR DOWNLOAD (com validação e transação atômica)
    // ========================================================================

    // ========================================================================
    // 6. REGISTRAR DOWNLOAD (com validação e transação atômica)
    // ========================================================================
    console.log('📝 Attempting to register download', {
      userId: user.id,
      resourceId,
      ipAddress,
      userAgent: userAgent.substring(0, 50)
    })

    let downloadResult: any = null
    let registerError: any = null

    try {
      const rpcParams = {
        p_user_id: user.id,
        p_resource_id: resourceId,
        p_ip_address: ipAddress || null,
        p_user_agent: userAgent || null
      }

      console.log('🔍 Calling register_download RPC with params:', rpcParams)

      const result = await supabase
        .rpc('register_download', rpcParams)

      console.log('📥 RPC result:', {
        hasData: !!result.data,
        dataLength: result.data?.length,
        hasError: !!result.error,
        error: result.error
      })

      downloadResult = result.data
      registerError = result.error

      if (result.error) {
        console.error('❌ RPC Error details:', {
          message: result.error.message,
          code: result.error.code,
          details: result.error.details,
          hint: result.error.hint,
          fullError: JSON.stringify(result.error, null, 2)
        })
      }
    } catch (err: any) {
      console.error('❌ Download failed: Exception in register_download', {
        userId: user.id,
        resourceId,
        error: err,
        message: err?.message,
        stack: err?.stack
      })
      registerError = err
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

    const result = downloadResult[0]

    if (!result.success) {
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

    // ========================================================================
    // 7. GERAR URL ASSINADA (apenas após todas as validações)
    // ========================================================================
    const signedUrl = await getSignedDownloadUrl(key, 3600) // 1 hora de validade

    // ========================================================================
    // 8. INVALIDAR CACHE (download foi registrado, status mudou)
    // ========================================================================
    deleteCacheByPrefix(`download_status:${user.id}`)
    deleteCacheByPrefix(`download_limit:${user.id}`)

    // ========================================================================
    // 9. VERIFICAR SE DOWNLOAD FOI REALMENTE REGISTRADO NO BANCO
    // ========================================================================
    // Verificação adicional: confirmar que o download foi inserido
    const { data: verifyDownload, error: verifyError } = await supabase
      .from('downloads')
      .select('id, created_at')
      .eq('id', result.download_id)
      .single()

    if (verifyError || !verifyDownload) {
      console.error('⚠️ WARNING: Download ID retornado mas não encontrado no banco!', {
        downloadId: result.download_id,
        error: verifyError
      })
    } else {
      console.log('✅ Download confirmado no banco:', {
        downloadId: result.download_id,
        createdAt: verifyDownload.created_at
      })
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
      message: result.remaining === 0 
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


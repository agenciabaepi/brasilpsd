import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { getDownloadStatus } from '@/lib/utils/downloads'
import { getCache, setCache, deleteCache, getDownloadStatusCacheKey, DOWNLOAD_STATUS_CACHE_TTL } from '@/lib/utils/cache'

/**
 * API Route: GET /api/downloads/status
 * 
 * Retorna o status de downloads do usuário autenticado
 * 
 * Query params:
 * - t: timestamp para forçar atualização (ignora cache)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { 
          error: 'Não autorizado',
          message: 'Você precisa estar autenticado para verificar seu status de downloads.'
        },
        { status: 401 }
      )
    }

    // Verificar se deve forçar atualização (parâmetro 't' presente)
    const searchParams = request.nextUrl.searchParams
    const forceRefresh = searchParams.has('t')

    const cacheKey = getDownloadStatusCacheKey(user.id)
    
    // Se forçar refresh, deletar cache
    if (forceRefresh) {
      deleteCache(cacheKey)
    }

    // Tentar obter do cache primeiro (se não forçar refresh)
    let status = forceRefresh ? null : getCache<any>(cacheKey)

    if (!status) {
      // Obter status de downloads usando a função helper
      status = await getDownloadStatus(user.id)

      if (!status) {
        return NextResponse.json(
          { 
            error: 'Erro ao obter status de downloads',
            message: 'Não foi possível obter seu status de downloads. Por favor, tente novamente.'
          },
          { status: 500 }
        )
      }

      // Armazenar no cache
      setCache(cacheKey, status, DOWNLOAD_STATUS_CACHE_TTL)
    }

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'private, max-age=30', // 30 segundos
        'X-Cache-Status': getCache(cacheKey) ? 'HIT' : 'MISS'
      }
    })
  } catch (error: any) {
    console.error('Error in /api/downloads/status:', error)
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}


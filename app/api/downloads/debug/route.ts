import { NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

/**
 * Endpoint de debug para testar o sistema de downloads
 * GET /api/downloads/debug
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Testar função get_user_download_status
    const { data: status, error: statusError } = await supabase
      .rpc('get_user_download_status', { p_user_id: user.id })

    // Testar função count_user_downloads_today
    // Esta função retorna um INTEGER, então o Supabase retorna um array com um único valor
    const { data: countTodayData, error: countError } = await supabase
      .rpc('count_user_downloads_today', { p_user_id: user.id })
    
    // Extrair o valor do array (função retorna INTEGER, Supabase retorna [value])
    const countToday = Array.isArray(countTodayData) && countTodayData.length > 0 
      ? countTodayData[0] 
      : (countTodayData !== null && countTodayData !== undefined ? countTodayData : null)

    // Verificar downloads na tabela
    const { data: downloads, error: downloadsError } = await supabase
      .from('downloads')
      .select('id, created_at, resource_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Verificar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      status: status || null,
      statusError: statusError?.message || null,
      countToday: countToday,
      countError: countError?.message || null,
      downloads: downloads || [],
      downloadsError: downloadsError?.message || null,
      downloadsCount: downloads?.length || 0
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erro interno',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}


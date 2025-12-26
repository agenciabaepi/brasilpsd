import { NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

/**
 * Endpoint de teste temporário para debug
 * GET /api/downloads/test
 * 
 * Testa todas as funções do sistema de downloads
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado', userId: null },
        { status: 401 }
      )
    }

    const results: any = {
      userId: user.id,
      tests: {}
    }

    // Teste 1: check_download_limit
    try {
      const { data, error } = await supabase
        .rpc('check_download_limit', { p_user_id: user.id })
      
      results.tests.check_download_limit = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null,
        data: data
      }
    } catch (err: any) {
      results.tests.check_download_limit = {
        success: false,
        error: {
          message: err.message,
          stack: err.stack
        }
      }
    }

    // Teste 2: get_user_download_status
    try {
      const { data, error } = await supabase
        .rpc('get_user_download_status', { p_user_id: user.id })
      
      results.tests.get_user_download_status = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null,
        data: data
      }
    } catch (err: any) {
      results.tests.get_user_download_status = {
        success: false,
        error: {
          message: err.message,
          stack: err.stack
        }
      }
    }

    // Teste 3: count_user_downloads_today
    try {
      const { data, error } = await supabase
        .rpc('count_user_downloads_today', { p_user_id: user.id })
      
      results.tests.count_user_downloads_today = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null,
        data: data
      }
    } catch (err: any) {
      results.tests.count_user_downloads_today = {
        success: false,
        error: {
          message: err.message,
          stack: err.stack
        }
      }
    }

    // Teste 4: Verificar perfil
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, subscription_tier, email')
        .eq('id', user.id)
        .single()
      
      results.tests.profile = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code
        } : null,
        data: profile
      }
    } catch (err: any) {
      results.tests.profile = {
        success: false,
        error: {
          message: err.message
        }
      }
    }

    // Teste 5: Verificar subscriptions
    try {
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
      
      results.tests.subscriptions = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code
        } : null,
        data: subscriptions
      }
    } catch (err: any) {
      results.tests.subscriptions = {
        success: false,
        error: {
          message: err.message
        }
      }
    }

    // Teste 6: Verificar estrutura da tabela downloads
    try {
      const { data: downloads, error } = await supabase
        .from('downloads')
        .select('id, user_id, created_at, downloaded_at')
        .eq('user_id', user.id)
        .limit(5)
      
      results.tests.downloads_table = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code
        } : null,
        sampleData: downloads,
        count: downloads?.length || 0
      }
    } catch (err: any) {
      results.tests.downloads_table = {
        success: false,
        error: {
          message: err.message
        }
      }
    }

    return NextResponse.json(results, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erro no teste',
        message: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}


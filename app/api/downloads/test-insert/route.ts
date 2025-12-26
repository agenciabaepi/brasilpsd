import { NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

/**
 * Endpoint de teste para verificar inserção de downloads
 * GET /api/downloads/test-insert?resourceId=xxx
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId')

    if (!resourceId) {
      return NextResponse.json(
        { error: 'resourceId é obrigatório' },
        { status: 400 }
      )
    }

    // Testar função register_download
    const { data: result, error: rpcError } = await supabase
      .rpc('register_download', {
        p_user_id: user.id,
        p_resource_id: resourceId,
        p_ip_address: '127.0.0.1',
        p_user_agent: 'Test'
      })

    // Verificar se o download foi inserido
    const { data: downloads, error: downloadsError } = await supabase
      .from('downloads')
      .select('id, created_at, resource_id')
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({
      rpcResult: result || null,
      rpcError: rpcError?.message || null,
      downloadsInTable: downloads || [],
      downloadsError: downloadsError?.message || null,
      message: rpcError 
        ? `Erro ao chamar register_download: ${rpcError.message}`
        : result && result.length > 0 && result[0].success
        ? 'Download registrado com sucesso!'
        : 'Download não foi registrado'
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


import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

/**
 * Endpoint para buscar assinaturas do Asaas
 * GET /api/admin/finance/subscriptions?status=ACTIVE&limit=100
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Obter parâmetros da query
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const customer = searchParams.get('customer')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    // Buscar assinaturas do Asaas
    const subscriptions = await asaas.getSubscriptions({
      status: status || undefined,
      customer: customer || undefined
    })

    // A resposta do Asaas pode vir em formato diferente, vamos normalizar
    const subscriptionsList = subscriptions.data || subscriptions || []

    return NextResponse.json({ 
      subscriptions: subscriptionsList.slice(offset, offset + limit),
      totalCount: subscriptionsList.length,
      hasMore: (offset + limit) < subscriptionsList.length
    })
  } catch (error: any) {
    console.error('Erro ao buscar assinaturas do Asaas:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao buscar assinaturas' 
    }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de debug para verificar assinaturas
 * GET /api/debug/subscription-check?userId=UUID
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

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || user.id

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const nowISO = now.toISOString()
    const nowDateOnly = now.toISOString().split('T')[0]

    console.log('🔍 Debug - Verificando assinatura para usuário:', userId)
    console.log('📅 Datas:', {
      today: today,
      nowISO: nowISO,
      nowDateOnly: nowDateOnly,
      now: now.toString()
    })

    // Buscar TODAS as assinaturas do usuário
    const { data: allSubscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id, tier, status, current_period_end, current_period_start, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (subError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar assinaturas',
        details: subError 
      }, { status: 500 })
    }

    // Buscar perfil do usuário
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_premium, subscription_tier')
      .eq('id', userId)
      .single()

    // Analisar cada assinatura
    const analysis = (allSubscriptions || []).map(sub => {
      const periodEnd = sub.current_period_end
      const periodEndDate = periodEnd ? new Date(periodEnd) : null
      const isExpired = periodEnd ? periodEnd < today : false
      const isExpiredDate = periodEndDate ? periodEndDate < now : false
      
      return {
        id: sub.id,
        tier: sub.tier,
        status: sub.status,
        current_period_end: periodEnd,
        current_period_end_type: typeof periodEnd,
        current_period_end_date: periodEndDate?.toISOString(),
        today: today,
        comparison_string: `${periodEnd} < ${today} = ${isExpired}`,
        comparison_date: periodEndDate ? `${periodEndDate.toISOString()} < ${nowISO} = ${isExpiredDate}` : 'N/A',
        isExpired: isExpired,
        isExpiredDate: isExpiredDate,
        daysDifference: periodEndDate ? Math.floor((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
      }
    })

    return NextResponse.json({
      userId,
      userProfile: userProfile || null,
      today,
      nowISO,
      nowDateOnly,
      allSubscriptions: allSubscriptions || [],
      analysis,
      activeSubscriptions: (allSubscriptions || []).filter(s => s.status === 'active'),
      expiredSubscriptions: analysis.filter(a => a.isExpired),
      recommendations: {
        shouldBlock: analysis.some(a => a.status === 'active' && a.isExpired),
        activeSubscription: analysis.find(a => a.status === 'active' && !a.isExpired),
        expiredActiveSubscription: analysis.find(a => a.status === 'active' && a.isExpired)
      }
    })
  } catch (error: any) {
    console.error('❌ Erro no debug:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar assinatura',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}



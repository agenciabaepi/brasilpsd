import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

/**
 * Endpoint para buscar estatísticas financeiras do Asaas
 * GET /api/admin/finance/stats
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

    // Buscar dados em paralelo
    const [paymentsResponse, subscriptionsResponse, transactionsData] = await Promise.all([
      // Pagamentos do Asaas
      asaas.getPayments({ limit: 1000 }).catch(() => ({ data: [] })),
      // Assinaturas do Asaas
      asaas.getSubscriptions().catch(() => ({ data: [] })),
      // Transações do nosso banco
      supabase
        .from('transactions')
        .select('status, amount_liquid, amount_brute, created_at')
        .order('created_at', { ascending: false })
    ])

    const payments = paymentsResponse.data || []
    const subscriptions = subscriptionsResponse.data || subscriptionsResponse || []
    const transactions = transactionsData.data || []

    // Calcular estatísticas de pagamentos
    const paymentsByStatus = {
      PENDING: payments.filter((p: any) => p.status === 'PENDING').length,
      CONFIRMED: payments.filter((p: any) => p.status === 'CONFIRMED').length,
      RECEIVED: payments.filter((p: any) => p.status === 'RECEIVED').length,
      OVERDUE: payments.filter((p: any) => p.status === 'OVERDUE').length,
      REFUNDED: payments.filter((p: any) => p.status === 'REFUNDED').length,
      DELETED: payments.filter((p: any) => p.status === 'DELETED').length,
    }

    // Calcular valores
    // O Asaas cria transações separadas: uma positiva (pagamento) e negativas (taxas)
    // Exemplo: R$ 5,00 (cobrança) + R$ -0,99 (taxa PIX) + R$ -0,99 (taxa mensageria)
    
    // Identificar pagamentos recebidos (valores positivos, excluindo taxas)
    const confirmedPayments = payments.filter((p: any) => {
      if (p.status !== 'CONFIRMED' && p.status !== 'RECEIVED') return false
      if (Number(p.value) <= 0) return false // Apenas valores positivos
      
      const desc = (p.description || '').toLowerCase()
      // Excluir transações que são taxas (mesmo que tenham valor positivo)
      if (desc.includes('taxa') || desc.includes('fee') || desc.includes('mensageria')) return false
      
      // Excluir se a descrição menciona "cobrança recebida" mas é na verdade uma taxa
      // Incluir apenas "Cobrança recebida" (pagamento principal)
      return desc.includes('cobrança recebida') || desc.includes('recebida')
    })
    
    // Identificar taxas (valores negativos OU descrições que indicam taxa)
    const fees = payments.filter((p: any) => {
      if (p.status !== 'CONFIRMED' && p.status !== 'RECEIVED') return false
      
      const desc = (p.description || '').toLowerCase()
      const value = Number(p.value) || 0
      
      // Taxas são valores negativos OU descrições com palavras-chave de taxa
      return value < 0 || 
             desc.includes('taxa do pix') || 
             desc.includes('taxa de mensageria') ||
             desc.includes('taxa') ||
             desc.includes('fee') ||
             desc.includes('mensageria')
    })

    // Calcular receita bruta total (apenas pagamentos positivos, sem taxas)
    const totalRevenue = confirmedPayments
      .reduce((sum: number, p: any) => sum + Math.abs(Number(p.value) || 0), 0)

    // Calcular taxas totais (soma absoluta dos valores das taxas)
    // Como as taxas são negativas, precisamos usar Math.abs
    const totalFees = fees.reduce((sum: number, f: any) => {
      const feeValue = Number(f.value) || 0
      // Se for negativo, já está correto. Se for positivo (improvável), também conta
      return sum + Math.abs(feeValue)
    }, 0)

    // Calcular valor líquido (receita bruta - taxas)
    const totalNetValue = totalRevenue - totalFees

    const pendingAmount = payments
      .filter((p: any) => p.status === 'PENDING')
      .reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0)

    const overdueAmount = payments
      .filter((p: any) => p.status === 'OVERDUE')
      .reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0)

    // Calcular receita mensal (últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Filtrar pagamentos mensais (apenas valores positivos, excluindo taxas)
    const monthlyPayments = payments.filter((p: any) => {
      if (p.status !== 'CONFIRMED' && p.status !== 'RECEIVED') return false
      
      const paymentDate = p.paymentDate ? new Date(p.paymentDate) : null
      if (!paymentDate || paymentDate < thirtyDaysAgo) return false
      
      if (Number(p.value) <= 0) return false // Apenas valores positivos
      
      const desc = (p.description || '').toLowerCase()
      // Excluir transações que são taxas
      if (desc.includes('taxa') || desc.includes('fee') || desc.includes('mensageria')) return false
      
      // Incluir apenas "Cobrança recebida" (pagamento principal)
      return desc.includes('cobrança recebida') || desc.includes('recebida')
    })
    
    // Filtrar taxas mensais
    const monthlyFeesList = payments.filter((p: any) => {
      if (p.status !== 'CONFIRMED' && p.status !== 'RECEIVED') return false
      
      const paymentDate = p.paymentDate ? new Date(p.paymentDate) : null
      if (!paymentDate || paymentDate < thirtyDaysAgo) return false
      
      const desc = (p.description || '').toLowerCase()
      const value = Number(p.value) || 0
      
      // Taxas são valores negativos OU descrições com palavras-chave de taxa
      return value < 0 || 
             desc.includes('taxa do pix') || 
             desc.includes('taxa de mensageria') ||
             desc.includes('taxa') ||
             desc.includes('fee') ||
             desc.includes('mensageria')
    })
    
    const monthlyRevenue = monthlyPayments
      .reduce((sum: number, p: any) => sum + Math.abs(Number(p.value) || 0), 0)

    const monthlyFees = monthlyFeesList.reduce((sum: number, f: any) => {
      const feeValue = Number(f.value) || 0
      return sum + Math.abs(feeValue)
    }, 0)

    const monthlyNetValue = monthlyRevenue - monthlyFees

    // Assinaturas por status
    const subscriptionsByStatus = {
      ACTIVE: subscriptions.filter((s: any) => s.status === 'ACTIVE').length,
      INACTIVE: subscriptions.filter((s: any) => s.status === 'INACTIVE').length,
      EXPIRED: subscriptions.filter((s: any) => s.status === 'EXPIRED').length,
      CANCELED: subscriptions.filter((s: any) => s.status === 'CANCELED').length,
    }

    // MRR (Monthly Recurring Revenue)
    const mrr = subscriptions
      .filter((s: any) => s.status === 'ACTIVE')
      .reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0)

    // Métodos de pagamento
    const paymentsByMethod = {
      PIX: payments.filter((p: any) => p.billingType === 'PIX').length,
      BOLETO: payments.filter((p: any) => p.billingType === 'BOLETO').length,
      CREDIT_CARD: payments.filter((p: any) => p.billingType === 'CREDIT_CARD').length,
    }

    return NextResponse.json({
      payments: {
        total: payments.length,
        byStatus: paymentsByStatus,
        totalRevenue,
        totalNetValue,
        totalFees,
        pendingAmount,
        overdueAmount,
        monthlyRevenue,
        monthlyNetValue,
        monthlyFees,
        byMethod: paymentsByMethod
      },
      subscriptions: {
        total: subscriptions.length,
        byStatus: subscriptionsByStatus,
        mrr
      },
      transactions: {
        total: transactions.length,
        paid: transactions.filter(t => t.status === 'paid').length,
        pending: transactions.filter(t => t.status === 'pending').length,
        totalRevenue: transactions
          .filter(t => t.status === 'paid')
          .reduce((sum, t) => sum + (Number(t.amount_liquid) || 0), 0)
      }
    })
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas financeiras:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao buscar estatísticas' 
    }, { status: 500 })
  }
}


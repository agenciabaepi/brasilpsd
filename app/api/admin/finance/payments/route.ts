import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

// Forçar renderização dinâmica (usa cookies para autenticação)
export const dynamic = 'force-dynamic'

/**
 * Endpoint para buscar pagamentos do Asaas
 * GET /api/admin/finance/payments?status=PENDING&limit=100
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
    const subscription = searchParams.get('subscription')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    // Buscar TODOS os pagamentos do Asaas (sem filtro de status) para pegar taxas também
    const paymentsResponse = await asaas.getPayments({
      // Não passar status aqui para pegar todas as transações, incluindo taxas
      limit: limit * 10, // Buscar muito mais para garantir que pegamos todas as taxas relacionadas
      offset
    })

    const allPayments = paymentsResponse.data || []
    
    // Função para extrair número da fatura da descrição
    const extractInvoiceNumber = (description: string): string | null => {
      if (!description) return null
      // Procura por padrões como "fatura nr. 707128775" ou "fatura 707128775"
      const match = description.match(/fatura\s*(?:nr\.?|n[úu]mero|#)?\s*(\d+)/i)
      return match ? match[1] : null
    }
    
    // Separar pagamentos principais e taxas de TODAS as transações
    const fees = allPayments.filter((p: any) => {
      const desc = (p.description || '').toLowerCase()
      const value = Number(p.value) || 0
      return value < 0 || 
             desc.includes('taxa do pix') || 
             desc.includes('taxa de mensageria') ||
             desc.includes('taxa') ||
             desc.includes('fee') ||
             desc.includes('mensageria')
    })
    
    // Filtrar pagamentos principais (aplicar filtro de status aqui se necessário)
    let mainPayments = allPayments.filter((p: any) => {
      // Incluir todos os status para exibição inicialmente
      if (Number(p.value) <= 0) return false // Apenas valores positivos
      const desc = (p.description || '').toLowerCase()
      // Excluir transações que são taxas
      return !desc.includes('taxa') && !desc.includes('fee') && !desc.includes('mensageria')
    })
    
    // Aplicar filtro de status apenas aos pagamentos principais
    if (status && status !== 'all') {
      mainPayments = mainPayments.filter((p: any) => p.status === status)
    }
    
    // Agrupar taxas por número da fatura extraído da descrição
    const feesByInvoice: Record<string, any[]> = {}
    fees.forEach((fee: any) => {
      const invoiceNum = extractInvoiceNumber(fee.description || '')
      const key = invoiceNum || fee.invoiceNumber || fee.invoice?.id || fee.customer || 'unknown'
      if (!feesByInvoice[key]) {
        feesByInvoice[key] = []
      }
      feesByInvoice[key].push(fee)
    })
    
    // Processar pagamentos principais e adicionar taxas relacionadas
    const processedPayments = mainPayments.map((payment: any) => {
      const grossValue = Number(payment.value) || 0
      
      // Tentar encontrar taxas relacionadas por número da fatura
      const invoiceNum = extractInvoiceNumber(payment.description || '')
      const invoiceKey = invoiceNum || payment.invoiceNumber || payment.invoice?.id || payment.customer || 'unknown'
      const relatedFees = feesByInvoice[invoiceKey] || []
      
      // Se não encontrou por invoice, tentar por customer e data próxima (mesmo dia)
      let feesByDate: any[] = []
      if (relatedFees.length === 0 && payment.customer && payment.paymentDate) {
        const paymentDate = new Date(payment.paymentDate)
        feesByDate = fees.filter((f: any) => {
          if (f.customer !== payment.customer) return false
          const feeDate = f.paymentDate ? new Date(f.paymentDate) : null
          if (!feeDate) return false
          // Taxas do mesmo dia
          return feeDate.toDateString() === paymentDate.toDateString()
        })
      }
      
      const allRelatedFees = relatedFees.length > 0 ? relatedFees : feesByDate
      
      // Calcular taxas totais relacionadas do Asaas
      const feesFromAsaas = allRelatedFees.reduce((sum: number, f: any) => {
        const feeValue = Math.abs(Number(f.value) || 0)
        return sum + feeValue
      }, 0)
      
      // Calcular taxa manualmente: R$ 1,98 por pagamento PIX recebido/confirmado
      let calculatedFees = feesFromAsaas
      if (payment.billingType === 'PIX' && (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED')) {
        // Se não encontrou taxas do Asaas ou se a taxa calculada manualmente é maior, usar a manual
        const manualFee = 1.98
        if (feesFromAsaas === 0 || manualFee > feesFromAsaas) {
          calculatedFees = manualFee
        }
      }
      
      // Calcular valor líquido
      const netValue = grossValue - calculatedFees
      
      return {
        ...payment,
        // Manter o valor original
        value: grossValue,
        // Adicionar campos calculados (sempre retornar valores, mesmo que 0)
        calculatedFees: calculatedFees,
        calculatedNetValue: netValue,
        // Manter netValue do Asaas se existir, senão usar o calculado
        netValue: payment.netValue || netValue,
        relatedFeesCount: allRelatedFees.length
      }
    })
    
    // Aplicar limite após processamento
    const limitedPayments = processedPayments.slice(0, limit)

    return NextResponse.json({ 
      payments: limitedPayments,
      totalCount: mainPayments.length,
      hasMore: mainPayments.length > limit
    })
  } catch (error: any) {
    console.error('Erro ao buscar pagamentos do Asaas:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao buscar pagamentos' 
    }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { asaas } from '@/lib/asaas/client'

/**
 * Endpoint para atualizar o status de todas as transações pendentes do usuário
 * Verifica no Asaas e atualiza no banco de dados
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar todas as transações pendentes do usuário
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'paid']) // Verificar pendentes e pagas (para garantir que estão atualizadas)
      .order('created_at', { ascending: false })

    if (transactionsError) {
      console.error('Erro ao buscar transações:', transactionsError)
      return NextResponse.json({ error: 'Erro ao buscar transações' }, { status: 500 })
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ transactions: [], updated: 0 })
    }

    let updatedCount = 0
    const updatedTransactions = []

    // Verificar cada transação no Asaas
    for (const transaction of transactions) {
      try {
        // Buscar pagamento no Asaas
        const payment = await asaas.fetch(`/payments/${transaction.id}`)
        
        // Mapear status do Asaas para nosso status
        let newStatus = transaction.status
        if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
          newStatus = 'paid'
        } else if (payment.status === 'PENDING') {
          newStatus = 'pending'
        } else if (payment.status === 'OVERDUE') {
          newStatus = 'overdue'
        } else if (payment.status === 'CANCELED' || payment.status === 'DELETED') {
          newStatus = 'canceled'
        }

        // Se o status mudou, atualizar no banco
        if (newStatus !== transaction.status) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              status: newStatus,
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value),
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id)

          if (!updateError) {
            updatedCount++
            updatedTransactions.push({
              ...transaction,
              status: newStatus,
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value)
            })
          } else {
            console.error(`Erro ao atualizar transação ${transaction.id}:`, updateError)
          }
        } else {
          // Mesmo que o status não mude, atualizar valores se necessário
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value),
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id)

          if (!updateError) {
            updatedTransactions.push({
              ...transaction,
              amount_liquid: payment.netValue || payment.value,
              amount_fees: payment.value - (payment.netValue || payment.value)
            })
          }
        }
      } catch (error: any) {
        console.error(`Erro ao verificar pagamento ${transaction.id} no Asaas:`, error)
        // Continuar com as outras transações mesmo se uma falhar
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      transactions: updatedTransactions
    })
  } catch (error: any) {
    console.error('Erro ao atualizar transações:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao atualizar transações' 
    }, { status: 500 })
  }
}



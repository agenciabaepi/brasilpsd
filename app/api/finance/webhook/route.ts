import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createSupabaseAdmin()

    console.log('Asaas Webhook Received:', body.event)

    const payment = body.payment
    const event = body.event

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const userId = payment.externalReference
      const tier = payment.description.split('Plano ')[1] // Pega o tier da descrição

      // 1. Atualizar transação no banco
      await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
          amount_liquid: payment.netValue, // Valor real que caiu na conta
          amount_fees: payment.value - payment.netValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)

      // 2. Liberar Premium para o Usuário
      if (userId) {
        await supabase
          .from('profiles')
          .update({
            is_premium: true,
            subscription_tier: tier?.toLowerCase() || 'lite'
          })
          .eq('id', userId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


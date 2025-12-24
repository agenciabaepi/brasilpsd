'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { CreditCard, Calendar, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import toast from 'react-hot-toast'

export default function BillingPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadTransactions()
  }, [])

  async function loadTransactions() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar transações')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cobrança</h1>
          <p className="text-gray-600">Histórico de pagamentos e assinaturas</p>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <Card key={transaction.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Assinatura {transaction.subscription_tier?.toUpperCase() || 'Premium'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {format(new Date(transaction.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      R$ {transaction.amount_brute?.toFixed(2).replace('.', ',') || '0,00'}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      transaction.status === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : transaction.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {transaction.status === 'paid' ? 'Pago' : transaction.status === 'pending' ? 'Pendente' : 'Cancelado'}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-4">Nenhuma transação encontrada</p>
            <a
              href="/premium"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver planos premium
            </a>
          </Card>
        )}
      </div>
    </div>
  )
}


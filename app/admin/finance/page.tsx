'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  QrCode,
  CreditCard,
  Search
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

export default function AdminFinancePage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingPix: 0,
    activeSubscribers: 0
  })
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadFinanceData()
  }, [])

  async function loadFinanceData() {
    setLoading(true)
    try {
      const { data: trans, error } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTransactions(trans || [])

      // Calcular estatísticas simples
      const total = trans?.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.amount_liquid), 0) || 0
      const pending = trans?.filter(t => t.status === 'pending' && t.payment_method === 'pix_manual').length || 0
      
      setStats({
        totalRevenue: total,
        monthlyRevenue: total, // Simplificado para o exemplo
        pendingPix: pending,
        activeSubscribers: 0 // Precisaria contar usuários com is_premium
      })
    } catch (error: any) {
      toast.error('Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprovePix(id: string, userId: string, tier: string) {
    try {
      // 1. Marcar transação como paga
      const { error: transError } = await supabase
        .from('transactions')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (transError) throw transError

      // 2. Liberar Premium para o usuário
      const { error: userError } = await supabase
        .from('profiles')
        .update({ 
          is_premium: true, 
          subscription_tier: tier 
        })
        .eq('id', userId)

      if (userError) throw userError

      toast.success('Pagamento PIX aprovado e Premium liberado!')
      loadFinanceData()
    } catch (error: any) {
      toast.error('Erro ao aprovar PIX')
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Gestão Financeira</h1>
        <p className="text-gray-500 font-medium">Controle de receitas, assinaturas e pagamentos PIX.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceStatCard title="Receita Total" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="green" />
        <FinanceStatCard title="Receita Mensal" value={formatCurrency(stats.monthlyRevenue)} icon={TrendingUp} color="blue" />
        <FinanceStatCard title="PIX Pendentes" value={stats.pendingPix} icon={Clock} color="orange" />
        <FinanceStatCard title="Assinantes Ativos" value={stats.activeSubscribers} icon={CheckCircle2} color="purple" />
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="border-none p-0 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
            <h2 className="font-semibold text-gray-800 text-sm tracking-tight">Transações Recentes</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por e-mail ou nome..." 
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plano</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Método</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Líquido</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{t.profiles?.full_name || 'Usuário'}</span>
                        <span className="text-[10px] text-gray-400">{t.profiles?.email}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">
                        {t.subscription_tier}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-2">
                        {t.payment_method === 'pix_manual' ? (
                          <QrCode className="h-3 w-3 text-blue-500" />
                        ) : (
                          <CreditCard className="h-3 w-3 text-purple-500" />
                        )}
                        <span className="text-xs font-medium text-gray-600">
                          {t.payment_method === 'pix_manual' ? 'PIX' : 'Stripe'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-900">
                      {formatCurrency(t.amount_liquid)}
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest",
                        t.status === 'paid' ? "bg-green-100 text-gray-900" :
                        t.status === 'pending' ? "bg-orange-100 text-orange-600" :
                        "bg-red-100 text-red-600"
                      )}>
                        {t.status === 'paid' ? 'Confirmado' : t.status === 'pending' ? 'Pendente' : 'Falhou'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {t.status === 'pending' && t.payment_method === 'pix_manual' && (
                        <button 
                          onClick={() => handleApprovePix(t.id, t.user_id, t.subscription_tier)}
                          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-[10px] font-bold rounded-lg transition-all uppercase"
                        >
                          Confirmar PIX
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-gray-400 font-medium text-sm">
                      Nenhuma transação registrada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

function FinanceStatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    green: 'bg-green-50 text-gray-900',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card className="border-none flex items-center space-x-4 p-6 shadow-sm">
      <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", colors[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 tracking-tighter leading-none">{value}</p>
      </div>
    </Card>
  )
}


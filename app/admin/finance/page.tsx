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
  Barcode,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Repeat,
  Calendar,
  Eye,
  ExternalLink
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

type Tab = 'overview' | 'payments' | 'subscriptions' | 'transactions'
type PaymentStatus = 'all' | 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'REFUNDED'

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [asaasConnected, setAsaasConnected] = useState(true)
  
  // Stats
  const [stats, setStats] = useState<any>(null)
  
  // Payments
  const [payments, setPayments] = useState<any[]>([])
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus>('all')
  const [paymentSearch, setPaymentSearch] = useState('')
  
  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<string>('all')
  
  // Transactions (local)
  const [transactions, setTransactions] = useState<any[]>([])
  
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'payments') {
      loadPayments()
    } else if (activeTab === 'subscriptions') {
      loadSubscriptions()
    } else if (activeTab === 'transactions') {
      loadTransactions()
    }
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      await Promise.all([
        loadStats(),
        loadTransactions()
      ])
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/finance/stats')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (errorData.error?.includes('Asaas') || errorData.error?.includes('API')) {
          setAsaasConnected(false)
        }
        throw new Error(errorData.error || 'Erro ao carregar estatísticas')
      }
      
      const data = await res.json()
      setStats(data)
      setAsaasConnected(true)
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error)
      if (!error.message?.includes('Asaas')) {
        toast.error('Erro ao carregar estatísticas')
      }
    }
  }

  async function loadPayments() {
    try {
      const params = new URLSearchParams()
      if (paymentStatusFilter !== 'all') {
        params.append('status', paymentStatusFilter)
      }
      params.append('limit', '100')

      const res = await fetch(`/api/admin/finance/payments?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao carregar pagamentos')
      }
      
      const data = await res.json()
      setPayments(data.payments || [])
    } catch (error: any) {
      console.error('Erro ao carregar pagamentos:', error)
      toast.error('Erro ao carregar pagamentos do Asaas')
      setPayments([])
    }
  }

  async function loadSubscriptions() {
    try {
      const params = new URLSearchParams()
      if (subscriptionStatusFilter !== 'all') {
        params.append('status', subscriptionStatusFilter)
      }
      params.append('limit', '100')

      const res = await fetch(`/api/admin/finance/subscriptions?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao carregar assinaturas')
      }
      
      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
    } catch (error: any) {
      console.error('Erro ao carregar assinaturas:', error)
      toast.error('Erro ao carregar assinaturas do Asaas')
      setSubscriptions([])
    }
  }

  async function loadTransactions() {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar transações:', error)
      toast.error('Erro ao carregar transações')
      setTransactions([])
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await loadData()
      if (activeTab === 'payments') await loadPayments()
      if (activeTab === 'subscriptions') await loadSubscriptions()
      if (activeTab === 'transactions') await loadTransactions()
      toast.success('Dados atualizados!')
    } catch (error) {
      console.error('Erro ao atualizar:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const filteredPayments = payments.filter(p => {
    if (paymentSearch) {
      const search = paymentSearch.toLowerCase()
      return (
        p.description?.toLowerCase().includes(search) ||
        p.customer?.toLowerCase().includes(search) ||
        p.id?.toLowerCase().includes(search)
      )
    }
    return true
  })

  const filteredSubscriptions = subscriptions.filter(s => {
    if (subscriptionStatusFilter !== 'all') {
      return s.status === subscriptionStatusFilter
    }
    return true
  })

  const getPaymentStatusBadge = (status: string) => {
    const styles: any = {
      PENDING: 'bg-orange-100 text-orange-700',
      CONFIRMED: 'bg-primary-100 text-gray-900',
      RECEIVED: 'bg-primary-100 text-gray-900',
      OVERDUE: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-gray-100 text-gray-700',
      DELETED: 'bg-gray-100 text-gray-500',
    }
    const labels: any = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      RECEIVED: 'Recebido',
      OVERDUE: 'Vencido',
      REFUNDED: 'Reembolsado',
      DELETED: 'Excluído',
    }
    return (
      <span className={cn("text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest", styles[status] || styles.PENDING)}>
        {labels[status] || status}
      </span>
    )
  }

  const getSubscriptionStatusBadge = (status: string) => {
    const styles: any = {
      ACTIVE: 'bg-primary-100 text-gray-900',
      INACTIVE: 'bg-gray-100 text-gray-700',
      EXPIRED: 'bg-orange-100 text-orange-700',
      CANCELED: 'bg-red-100 text-red-700',
    }
    const labels: any = {
      ACTIVE: 'Ativa',
      INACTIVE: 'Inativa',
      EXPIRED: 'Expirada',
      CANCELED: 'Cancelada',
    }
    return (
      <span className={cn("text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest", styles[status] || styles.INACTIVE)}>
        {labels[status] || status}
      </span>
    )
  }

  const getBillingIcon = (type: string) => {
    if (type === 'PIX') return <QrCode className="h-3 w-3" />
    if (type === 'BOLETO') return <Barcode className="h-3 w-3" />
    return <CreditCard className="h-3 w-3" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Gestão Financeira</h1>
            <p className="text-gray-500 font-medium">Controle completo de receitas, assinaturas e pagamentos do Asaas.</p>
          </div>
          <div className="flex items-center space-x-3">
            {!asaasConnected && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2">
                <p className="text-xs font-semibold text-orange-700 flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Asaas desconectado</span>
                </p>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
          { id: 'payments', label: 'Pagamentos', icon: DollarSign },
          { id: 'subscriptions', label: 'Assinaturas', icon: Repeat },
          { id: 'transactions', label: 'Transações Locais', icon: CreditCard },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "px-6 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2",
              activeTab === tab.id
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FinanceStatCard 
              title="Receita Total (Bruta)" 
              value={formatCurrency(stats.payments?.totalRevenue || 0)} 
              icon={DollarSign} 
              color="green" 
            />
            <FinanceStatCard 
              title="Valor Líquido Total" 
              value={formatCurrency(stats.payments?.totalNetValue || 0)} 
              icon={TrendingUp} 
              color="blue" 
            />
            <FinanceStatCard 
              title="Taxas Totais (Asaas)" 
              value={formatCurrency(stats.payments?.totalFees || 0)} 
              icon={XCircle} 
              color="red" 
            />
            <FinanceStatCard 
              title="Pendentes" 
              value={stats.payments?.byStatus?.PENDING || 0} 
              icon={Clock} 
              color="orange" 
            />
          </div>

          {/* Monthly Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FinanceStatCard 
              title="Receita Mensal (Bruta)" 
              value={formatCurrency(stats.payments?.monthlyRevenue || 0)} 
              icon={DollarSign} 
              color="green" 
            />
            <FinanceStatCard 
              title="Valor Líquido Mensal" 
              value={formatCurrency(stats.payments?.monthlyNetValue || 0)} 
              icon={TrendingUp} 
              color="blue" 
            />
            <FinanceStatCard 
              title="Taxas Mensais (Asaas)" 
              value={formatCurrency(stats.payments?.monthlyFees || 0)} 
              icon={XCircle} 
              color="red" 
            />
          </div>

          {/* MRR */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FinanceStatCard 
              title="MRR" 
              value={formatCurrency(stats.subscriptions?.mrr || 0)} 
              icon={Repeat} 
              color="purple" 
            />
      </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payments by Status */}
            <Card className="border-none p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Pagamentos por Status</h3>
              <div className="space-y-4">
                {stats.payments?.byStatus && Object.entries(stats.payments.byStatus).map(([status, count]: [string, any]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{status}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Subscriptions by Status */}
            <Card className="border-none p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Assinaturas por Status</h3>
              <div className="space-y-4">
                {stats.subscriptions?.byStatus && Object.entries(stats.subscriptions.byStatus).map(([status, count]: [string, any]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{status}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card className="border-none p-0 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white flex-wrap gap-4">
            <div className="flex items-center space-x-4 flex-1 min-w-[300px]">
              <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                  placeholder="Buscar pagamentos..." 
                  value={paymentSearch}
                  onChange={e => setPaymentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select 
                  value={paymentStatusFilter}
                  onChange={e => setPaymentStatusFilter(e.target.value as PaymentStatus)}
                  className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/10"
                >
                  <option value="all">Todos os Status</option>
                  <option value="PENDING">Pendente</option>
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="RECEIVED">Recebido</option>
                  <option value="OVERDUE">Vencido</option>
                  <option value="REFUNDED">Reembolsado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Método</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Bruto</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Taxas</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Líquido</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vencimento</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <span className="text-xs font-mono text-gray-600">{payment.id?.substring(0, 12)}...</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-semibold text-gray-900">{payment.description || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-2">
                        {getBillingIcon(payment.billingType)}
                        <span className="text-xs font-medium text-gray-600">
                          {payment.billingType === 'PIX' ? 'PIX' : payment.billingType === 'BOLETO' ? 'Boleto' : 'Cartão'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(payment.value || 0)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {payment.calculatedFees !== undefined && payment.calculatedFees !== null ? (
                        <span className="text-xs font-semibold text-red-600">
                          {formatCurrency(payment.calculatedFees)}
                        </span>
                      ) : payment.netValue ? (
                        <span className="text-xs font-semibold text-red-600">
                          {formatCurrency((payment.value || 0) - (payment.netValue || 0))}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      {payment.calculatedNetValue !== undefined && payment.calculatedNetValue !== null ? (
                        <span className="text-sm font-bold text-primary-600">
                          {formatCurrency(payment.calculatedNetValue)}
                        </span>
                      ) : payment.netValue ? (
                        <span className="text-sm font-bold text-primary-600">
                          {formatCurrency(payment.netValue || 0)}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(payment.value || 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      {payment.dueDate ? (
                        <span className="text-xs font-semibold text-gray-600">
                          {format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      {getPaymentStatusBadge(payment.status)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {payment.invoiceUrl && (
                        <a 
                          href={payment.invoiceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Ver</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-8 py-20 text-center text-gray-400 font-medium text-sm">
                      Nenhum pagamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <Card className="border-none p-0 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select 
                  value={subscriptionStatusFilter}
                  onChange={e => setSubscriptionStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/10"
                >
                  <option value="all">Todos os Status</option>
                  <option value="ACTIVE">Ativas</option>
                  <option value="INACTIVE">Inativas</option>
                  <option value="EXPIRED">Expiradas</option>
                  <option value="CANCELED">Canceladas</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ciclo</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Próxima Cobrança</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSubscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <span className="text-xs font-mono text-gray-600">{subscription.id?.substring(0, 12)}...</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-semibold text-gray-900">{subscription.description || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-900">
                      {formatCurrency(subscription.value || 0)}
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-medium text-gray-600">
                        {subscription.cycle === 'MONTHLY' ? 'Mensal' : subscription.cycle === 'YEARLY' ? 'Anual' : subscription.cycle}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {subscription.nextDueDate ? (
                        <span className="text-xs font-semibold text-gray-600">
                          {format(new Date(subscription.nextDueDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      {getSubscriptionStatusBadge(subscription.status)}
                    </td>
                  </tr>
                ))}
                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-gray-400 font-medium text-sm">
                      Nenhuma assinatura encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <Card className="border-none p-0 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
            <h2 className="font-semibold text-gray-800 text-sm tracking-tight">Transações do Banco de Dados</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plano</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Método</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Bruto</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Taxas</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Líquido</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data</th>
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
                        {t.payment_method?.includes('pix') ? (
                          <QrCode className="h-3 w-3 text-blue-500" />
                        ) : (
                          <CreditCard className="h-3 w-3 text-purple-500" />
                        )}
                        <span className="text-xs font-medium text-gray-600">
                          {t.payment_method || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(t.amount_brute || 0)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {t.amount_fees ? (
                        <span className="text-xs font-semibold text-red-600">
                          {formatCurrency(t.amount_fees || 0)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-primary-600">
                        {formatCurrency(t.amount_liquid || t.amount_brute || 0)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest",
                        t.status === 'paid' ? "bg-primary-100 text-gray-900" :
                        t.status === 'pending' ? "bg-orange-100 text-orange-600" :
                        "bg-red-100 text-red-600"
                      )}>
                        {t.status === 'paid' ? 'Confirmado' : t.status === 'pending' ? 'Pendente' : 'Falhou'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {t.created_at ? (
                        <span className="text-xs font-semibold text-gray-600">
                          {format(new Date(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-8 py-20 text-center text-gray-400 font-medium text-sm">
                      Nenhuma transação registrada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function FinanceStatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    green: 'bg-primary-50 text-gray-900',
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

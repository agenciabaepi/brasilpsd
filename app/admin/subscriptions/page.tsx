'use client'

import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  XCircle, 
  CheckCircle2,
  Search,
  Filter,
  MoreVertical,
  Eye,
  X,
  RotateCcw,
  Edit,
  Calendar,
  CreditCard,
  QrCode,
  Barcode,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'CANCELED'
type FilterStatus = 'all' | SubscriptionStatus

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null)
  const [asaasConnected, setAsaasConnected] = useState(true)
  const supabase = createSupabaseClient()

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    canceled: 0,
    mrr: 0, // Monthly Recurring Revenue
  })

  useEffect(() => {
    loadSubscriptions()
  }, [])

  async function loadSubscriptions() {
    setLoading(true)
    try {
      // Buscar usuários premium do nosso banco
      const { data: premiumUsers, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_premium', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Buscar assinaturas do Asaas via API
      let asaasSubscriptions: any[] = []
      try {
        const res = await fetch('/api/admin/subscriptions/list')
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.warn('Erro na resposta da API:', res.status, errorData)
          setAsaasConnected(false)
          // Não lançar erro aqui, apenas continuar sem dados do Asaas
        } else {
          const asaasData = await res.json()
          if (asaasData.error) {
            console.warn('Erro retornado pela API:', asaasData.error)
            setAsaasConnected(false)
          } else {
            asaasSubscriptions = asaasData.subscriptions || []
            setAsaasConnected(true)
          }
        }
      } catch (err: any) {
        console.warn('Erro ao buscar assinaturas do Asaas:', err.message)
        setAsaasConnected(false)
        // Não lançar erro, apenas continuar sem dados do Asaas
      }

      // Combinar dados do nosso banco com dados do Asaas
      const combined = premiumUsers?.map((user: any) => {
        // Buscar assinatura do Asaas pelo customer_id
        const asaasSub = asaasSubscriptions.find((s: any) => 
          s.customer === user.asaas_customer_id || 
          s.externalReference === user.subscription_tier
        )
        
        return {
          id: user.id,
          userId: user.id,
          userName: user.full_name || 'Sem nome',
          userEmail: user.email,
          tier: user.subscription_tier || 'pro',
          status: user.is_premium ? 'ACTIVE' : 'INACTIVE',
          amount: asaasSub?.value || (user.subscription_tier === 'lite' ? 19.90 : user.subscription_tier === 'pro' ? 29.90 : 49.90),
          cycle: asaasSub?.cycle || 'MONTHLY',
          billingType: asaasSub?.billingType || 'CREDIT_CARD',
          nextDueDate: asaasSub?.nextDueDate || null,
          createdAt: user.created_at,
          asaasId: asaasSub?.id || null,
          asaasCustomerId: user.asaas_customer_id,
          asaasData: asaasSub
        }
      }) || []

      setSubscriptions(combined)

      // Calcular estatísticas
      const active = combined.filter(s => s.status === 'ACTIVE').length
      const canceled = combined.filter(s => s.status === 'CANCELED').length
      const mrr = combined
        .filter(s => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + (s.amount || 0), 0)

      setStats({
        total: combined.length,
        active,
        canceled,
        mrr
      })
    } catch (error: any) {
      console.error('Erro ao carregar assinaturas:', error)
      // Não mostrar toast de erro se for apenas problema de conexão com Asaas
      // A página ainda funciona mostrando usuários premium do banco
      if (!error.message?.includes('Asaas') && !error.message?.includes('API')) {
        toast.error(`Erro ao carregar assinaturas: ${error.message || 'Erro desconhecido'}`)
      }
      // Mesmo com erro, tentar carregar pelo menos os usuários premium do banco
      try {
        const { data: premiumUsers } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_premium', true)
          .order('created_at', { ascending: false })

        if (premiumUsers) {
          const basicSubscriptions = premiumUsers.map((user: any) => ({
            id: user.id,
            userId: user.id,
            userName: user.full_name || 'Sem nome',
            userEmail: user.email,
            tier: user.subscription_tier || 'pro',
            status: user.is_premium ? 'ACTIVE' : 'INACTIVE',
            amount: user.subscription_tier === 'lite' ? 19.90 : user.subscription_tier === 'pro' ? 29.90 : 49.90,
            cycle: 'MONTHLY',
            billingType: 'CREDIT_CARD',
            nextDueDate: null,
            createdAt: user.created_at,
            asaasId: null,
            asaasCustomerId: user.asaas_customer_id,
            asaasData: null
          }))
          setSubscriptions(basicSubscriptions)
          setStats({
            total: basicSubscriptions.length,
            active: basicSubscriptions.filter(s => s.status === 'ACTIVE').length,
            canceled: 0,
            mrr: basicSubscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.amount || 0), 0)
          })
        } else {
          setSubscriptions([])
          setStats({ total: 0, active: 0, canceled: 0, mrr: 0 })
        }
      } catch (fallbackError) {
        setSubscriptions([])
        setStats({ total: 0, active: 0, canceled: 0, mrr: 0 })
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelSubscription(subscriptionId: string, asaasId: string | null) {
    if (!confirm('Tem certeza que deseja cancelar esta assinatura?')) return

    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asaasId })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      toast.success('Assinatura cancelada com sucesso!')
      loadSubscriptions()
      setShowActionsMenu(null)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar assinatura')
    }
  }

  async function handleReactivateSubscription(subscriptionId: string, asaasId: string | null) {
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asaasId })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      toast.success('Assinatura reativada com sucesso!')
      loadSubscriptions()
      setShowActionsMenu(null)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reativar assinatura')
    }
  }

  async function loadSubscriptionDetails(subscription: any) {
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscription.id}/details`)
      const data = await res.json()
      setSelectedSubscription({ ...subscription, details: data })
      setShowDetailsModal(true)
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes')
    }
  }

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = searchQuery === '' || 
      sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const styles: any = {
      ACTIVE: 'bg-green-100 text-green-700',
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
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Gestão de Assinaturas</h1>
            <p className="text-gray-500 font-medium">Controle completo de assinaturas, planos e renovações.</p>
          </div>
          {!asaasConnected && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2">
              <p className="text-xs font-semibold text-orange-700">
                ⚠️ Asaas desconectado - Exibindo apenas dados locais
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Assinantes" value={stats.total} icon={Users} color="blue" />
        <StatCard title="Assinantes Ativos" value={stats.active} icon={CheckCircle2} color="green" />
        <StatCard title="Canceladas" value={stats.canceled} icon={XCircle} color="red" />
        <StatCard title="Receita Recorrente (MRR)" value={formatCurrency(stats.mrr)} icon={TrendingUp} color="purple" />
      </div>

      {/* Filters and Search */}
      <Card className="border-none p-0 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 bg-white flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou e-mail..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as FilterStatus)}
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
          <Button onClick={loadSubscriptions} className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold rounded-xl">
            Atualizar
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plano</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Método</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Próxima Cobrança</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSubscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">{sub.userName}</span>
                      <span className="text-[10px] text-gray-400">{sub.userEmail}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">
                      {sub.tier || 'N/A'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(sub.amount)}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1">/{sub.cycle === 'MONTHLY' ? 'mês' : 'ano'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-2">
                      {getBillingIcon(sub.billingType)}
                      <span className="text-xs font-medium text-gray-600">
                        {sub.billingType === 'PIX' ? 'PIX' : sub.billingType === 'BOLETO' ? 'Boleto' : 'Cartão'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {sub.nextDueDate ? (
                      <span className="text-xs font-semibold text-gray-600">
                        {format(new Date(sub.nextDueDate), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    {getStatusBadge(sub.status)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setShowActionsMenu(showActionsMenu === sub.id ? null : sub.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                      {showActionsMenu === sub.id && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-10 overflow-hidden">
                          <button
                            onClick={() => {
                              loadSubscriptionDetails(sub)
                              setShowActionsMenu(null)
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Ver Detalhes</span>
                          </button>
                          {sub.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleCancelSubscription(sub.id, sub.asaasId)}
                              className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center space-x-2"
                            >
                              <X className="h-4 w-4" />
                              <span>Cancelar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateSubscription(sub.id, sub.asaasId)}
                              className="w-full px-4 py-3 text-left text-sm font-semibold text-green-600 hover:bg-green-50 flex items-center space-x-2"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Reativar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-gray-400 font-medium text-sm">
                    Nenhuma assinatura encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Details Modal */}
      {showDetailsModal && selectedSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowDetailsModal(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Detalhes da Assinatura</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Usuário</label>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{selectedSubscription.userName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedSubscription.userEmail}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plano</label>
                  <p className="text-sm font-bold text-gray-900 mt-1 uppercase">{selectedSubscription.tier}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</label>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(selectedSubscription.amount)}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedSubscription.status)}</div>
                </div>
              </div>

              {selectedSubscription.details?.payments && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Histórico de Pagamentos</h3>
                  <div className="space-y-2">
                    {selectedSubscription.details.payments.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(payment.value)}</p>
                          <p className="text-[10px] text-gray-400">{format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        </div>
                        <span className={cn(
                          "text-[9px] font-black px-2 py-1 rounded-md uppercase",
                          payment.status === 'CONFIRMED' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        )}>
                          {payment.status === 'CONFIRMED' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
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


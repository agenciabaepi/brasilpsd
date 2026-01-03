'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Download,
  Calendar,
  FileText,
  Filter,
  RefreshCw,
  Eye,
  BarChart3
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import type { CreatorEarning, Resource } from '@/types/database'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type EarningStatus = 'all' | 'pending' | 'paid' | 'processing'

export default function CreatorEarningsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [earnings, setEarnings] = useState<(CreatorEarning & { resource?: Resource })[]>([])
  const [stats, setStats] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<EarningStatus>('all')
  const [monthFilter, setMonthFilter] = useState<string>('')
  const [expandedEarnings, setExpandedEarnings] = useState<Set<string>>(new Set())
  
  const supabase = createSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [statusFilter, monthFilter])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      await Promise.all([
        loadEarnings(),
        loadStats()
      ])
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados de comissões')
    } finally {
      setLoading(false)
    }
  }

  async function loadEarnings() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('creator_earnings')
        .select(`
          *,
          resource:resources!resource_id(*)
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (monthFilter) {
        query = query.eq('month_year', monthFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setEarnings(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar earnings:', error)
      toast.error('Erro ao carregar comissões')
    }
  }

  async function loadStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: allEarnings },
        { data: pendingEarnings },
        { data: paidEarnings },
        { data: monthlyEarnings }
      ] = await Promise.all([
        supabase.from('creator_earnings').select('amount').eq('creator_id', user.id),
        supabase.from('creator_earnings').select('amount').eq('creator_id', user.id).eq('status', 'pending'),
        supabase.from('creator_earnings').select('amount').eq('creator_id', user.id).eq('status', 'paid'),
        supabase
          .from('creator_earnings')
          .select('amount, month_year')
          .eq('creator_id', user.id)
          .order('month_year', { ascending: false })
          .limit(12)
      ])

      const total = allEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const pending = pendingEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const paid = paidEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      // Agrupar por mês
      const monthly = (monthlyEarnings || []).reduce((acc: any, earning: any) => {
        const month = earning.month_year
        if (!acc[month]) {
          acc[month] = { month, total: 0, count: 0 }
        }
        acc[month].total += earning.amount || 0
        acc[month].count += 1
        return acc
      }, {})

      setStats({
        total,
        pending,
        paid,
        monthly: Object.values(monthly)
      })
    } catch (error: any) {
      console.error('Erro ao carregar stats:', error)
    }
  }

  async function refreshData() {
    setRefreshing(true)
    try {
      await loadData()
      toast.success('Dados atualizados')
    } catch (error: any) {
      console.error('Erro ao atualizar:', error)
      toast.error('Erro ao atualizar dados')
    } finally {
      setRefreshing(false)
    }
  }

  function toggleEarning(earningId: string) {
    setExpandedEarnings(prev => {
      const newSet = new Set(prev)
      if (newSet.has(earningId)) {
        newSet.delete(earningId)
      } else {
        newSet.add(earningId)
      }
      return newSet
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Comissões</h1>
          <p className="text-sm text-gray-500 mt-1">Acompanhe seus ganhos por download</p>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Ganho</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats?.total || 0)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pendente</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">
                {formatCurrency(stats?.pending || 0)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pago</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatCurrency(stats?.paid || 0)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Chart */}
      {stats?.monthly && stats.monthly.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ganhos por Mês</h3>
          <div className="space-y-3">
            {stats.monthly.map((month: any) => (
              <div key={month.month} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {format(new Date(month.month + '-01'), 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(month.total)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (month.total / (stats.total || 1)) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{month.count} downloads</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EarningStatus)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="processing">Processando</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>

      {/* Earnings List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Histórico de Comissões</h3>
        {earnings.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma comissão encontrada</p>
            <p className="text-sm text-gray-400 mt-2">
              Suas comissões aparecerão aqui quando seus recursos forem baixados
            </p>
          </Card>
        ) : (
          earnings.map((earning) => (
            <Card key={earning.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Link
                      href={`/resources/${earning.resource_id}`}
                      className="font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {earning.resource?.title || 'Recurso não encontrado'}
                    </Link>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      earning.status === 'pending' && "bg-yellow-100 text-yellow-700",
                      earning.status === 'paid' && "bg-green-100 text-green-700",
                      earning.status === 'processing' && "bg-blue-100 text-blue-700"
                    )}>
                      {earning.status === 'pending' ? 'Pendente' : earning.status === 'paid' ? 'Pago' : 'Processando'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(earning.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </span>
                    {earning.month_year && (
                      <>
                        <span>•</span>
                        <span>{format(new Date(earning.month_year + '-01'), 'MMMM yyyy', { locale: ptBR })}</span>
                      </>
                    )}
                  </div>
                  
                  {expandedEarnings.has(earning.id) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-sm">
                      {earning.commission_per_download && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Valor por download:</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(earning.commission_per_download)}
                          </span>
                        </div>
                      )}
                      {earning.downloads_in_pool && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Downloads no pool:</span>
                          <span className="font-medium text-gray-900">{earning.downloads_in_pool}</span>
                        </div>
                      )}
                      {earning.pool_amount && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Valor total do pool:</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(earning.pool_amount)}
                          </span>
                        </div>
                      )}
                      {earning.commission_rate && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Taxa de comissão:</span>
                          <span className="font-medium text-gray-900">{earning.commission_rate}%</span>
                        </div>
                      )}
                      {earning.paid_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Data do pagamento:</span>
                          <span className="font-medium text-gray-900">
                            {format(new Date(earning.paid_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4 ml-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(earning.amount)}
                    </p>
                    {earning.commission_rate && (
                      <p className="text-xs text-gray-500">
                        {earning.commission_rate}% do pool
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleEarning(earning.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expandedEarnings.has(earning.id) ? (
                      <Eye className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-primary-50 border-primary-200">
        <div className="flex items-start space-x-3">
          <BarChart3 className="h-5 w-5 text-primary-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-primary-900 mb-2">Como funciona o Revenue Pool?</h4>
            <p className="text-sm text-primary-700">
              O Revenue Pool é um sistema onde uma porcentagem da receita mensal de assinaturas é distribuída 
              entre os criadores proporcionalmente aos downloads de seus recursos. Cada download único gera 
              uma comissão calculada dividindo o valor disponível no pool pelo total de downloads do mês.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}


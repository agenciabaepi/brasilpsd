'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Calendar,
  Eye,
  Download,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  X
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import type { CreatorEarning, RevenuePool, Profile, Resource } from '@/types/database'
import Link from 'next/link'

type Tab = 'overview' | 'pools' | 'earnings' | 'creators'
type EarningStatus = 'all' | 'pending' | 'paid' | 'processing'

// Helper functions para formatar datas de forma segura
function formatMonthYear(monthYear: string): string {
  try {
    if (!monthYear) return ''
    return format(new Date(monthYear + '-01'), 'MMMM yyyy', { locale: ptBR })
  } catch {
    return monthYear
  }
}

function formatDate(dateString: string): string {
  try {
    if (!dateString) return ''
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateString
  }
}

export default function AdminCommissionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Stats
  const [stats, setStats] = useState<any>(null)
  
  // Revenue Pools
  const [pools, setPools] = useState<RevenuePool[]>([])
  const [selectedPool, setSelectedPool] = useState<RevenuePool | null>(null)
  const [editingPool, setEditingPool] = useState<string | null>(null)
  const [poolFormData, setPoolFormData] = useState({
    total_revenue: 0,
    commission_percentage: 30,
    premium_commission_amount: 0.40,
    free_commission_amount: 0.06,
    notes: ''
  })
  
  // Earnings
  const [earnings, setEarnings] = useState<(CreatorEarning & { creator?: Profile; resource?: Resource })[]>([])
  const [earningStatusFilter, setEarningStatusFilter] = useState<EarningStatus>('all')
  const [earningSearch, setEarningSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  
  // Creators stats
  const [creatorStats, setCreatorStats] = useState<any[]>([])
  
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'pools') {
      loadPools()
    } else if (activeTab === 'earnings') {
      loadEarnings()
    } else if (activeTab === 'creators') {
      loadCreatorStats()
    }
  }, [activeTab, earningStatusFilter, selectedMonth])

  async function loadData() {
    setLoading(true)
    try {
      // Sempre atualizar o pool ao carregar a página (garante dados atualizados)
      try {
        await supabase.rpc('update_revenue_pool_from_subscriptions')
      } catch (error) {
        console.log('Erro ao atualizar pool automaticamente:', error)
      }
      
      await Promise.all([
        loadStats(),
        loadPools()
      ])
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados de comissões')
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Obter mês atual
      const currentMonth = new Date().toISOString().slice(0, 7) // Formato YYYY-MM

      // Stats gerais
      const [
        { data: totalEarnings },
        { data: pendingEarnings },
        { data: paidEarnings },
        { data: currentPool }
      ] = await Promise.all([
        supabase.from('creator_earnings').select('amount'),
        supabase.from('creator_earnings').select('amount').eq('status', 'pending'),
        supabase.from('creator_earnings').select('amount').eq('status', 'paid'),
        supabase.from('revenue_pool').select('*').eq('month_year', currentMonth).single()
      ])

      const total = totalEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const pending = pendingEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const paid = paidEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      const statsData = {
        totalEarnings: total,
        pendingEarnings: pending,
        paidEarnings: paid,
        currentPool: currentPool?.data || null,
        totalCreators: new Set(totalEarnings?.map((e: any) => e.creator_id) || []).size
      }

      setStats(statsData)
      return statsData
    } catch (error: any) {
      console.error('Erro ao carregar stats:', error)
      return null
    }
  }

  async function loadPools() {
    try {
      const { data, error } = await supabase
        .from('revenue_pool')
        .select('*')
        .order('month_year', { ascending: false })
        .limit(12)

      if (error) throw error
      setPools(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar pools:', error)
      toast.error('Erro ao carregar pools de receita')
    }
  }

  async function loadEarnings() {
    try {
      let query = supabase
        .from('creator_earnings')
        .select(`
          *,
          creator:profiles!creator_id(*),
          resource:resources!resource_id(*)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (earningStatusFilter !== 'all') {
        query = query.eq('status', earningStatusFilter)
      }

      if (selectedMonth) {
        query = query.eq('month_year', selectedMonth)
      }

      if (earningSearch) {
        query = query.or(`creator.full_name.ilike.%${earningSearch}%,resource.title.ilike.%${earningSearch}%`)
      }

      const { data, error } = await query

      if (error) throw error
      setEarnings(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar earnings:', error)
      toast.error('Erro ao carregar comissões')
    }
  }

  async function loadCreatorStats() {
    try {
      const { data, error } = await supabase
        .from('creator_earnings')
        .select(`
          creator_id,
          creator:profiles!creator_id(full_name, email),
          amount,
          status
        `)

      if (error) throw error

      // Agrupar por criador
      const grouped = (data || []).reduce((acc: any, earning: any) => {
        const creatorId = earning.creator_id
        if (!acc[creatorId]) {
          acc[creatorId] = {
            creator_id: creatorId,
            creator: earning.creator,
            total: 0,
            pending: 0,
            paid: 0,
            count: 0
          }
        }
        acc[creatorId].total += earning.amount || 0
        acc[creatorId].count += 1
        if (earning.status === 'pending') {
          acc[creatorId].pending += earning.amount || 0
        } else if (earning.status === 'paid') {
          acc[creatorId].paid += earning.amount || 0
        }
        return acc
      }, {})

      setCreatorStats(Object.values(grouped).sort((a: any, b: any) => b.total - a.total))
    } catch (error: any) {
      console.error('Erro ao carregar stats de criadores:', error)
      toast.error('Erro ao carregar estatísticas de criadores')
    }
  }

  async function updatePool(poolId: string) {
    try {
      const pool = pools.find(p => p.id === poolId)
      if (!pool) {
        toast.error('Pool não encontrado')
        return
      }

      // Calcular remaining_amount baseado na nova receita
      const newRemaining = (poolFormData.total_revenue * (poolFormData.commission_percentage / 100.0)) - pool.distributed_amount

      const { error } = await supabase
        .from('revenue_pool')
        .update({
          total_revenue: poolFormData.total_revenue,
          commission_percentage: poolFormData.commission_percentage,
          premium_commission_amount: poolFormData.premium_commission_amount,
          free_commission_amount: poolFormData.free_commission_amount,
          commission_type: 'fixed',
          notes: poolFormData.notes,
          remaining_amount: newRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', poolId)

      if (error) throw error

      // Recalcular comissões se o pool tiver receita
      if (poolFormData.total_revenue > 0) {
        try {
          await supabase.rpc('recalculate_month_earnings', {
            p_month_year: pool.month_year
          })
          toast.success('Pool atualizado e comissões recalculadas com sucesso')
        } catch (recalcError) {
          console.error('Erro ao recalcular comissões:', recalcError)
          toast.success('Pool atualizado, mas houve erro ao recalcular comissões')
        }
      } else {
        toast.success('Pool atualizado com sucesso')
      }

      setEditingPool(null)
      setPoolFormData({ total_revenue: 0, commission_percentage: 30, notes: '' })
      await loadPools()
      await loadStats()
      await loadEarnings()
    } catch (error: any) {
      console.error('Erro ao atualizar pool:', error)
      toast.error('Erro ao atualizar pool')
    }
  }

  async function closePool(poolId: string, monthYear: string) {
    if (!confirm(`Tem certeza que deseja fechar o pool de ${monthYear}?`)) return

    try {
      const { error } = await supabase.rpc('close_revenue_pool', {
        p_month_year: monthYear
      })

      if (error) throw error

      toast.success('Pool fechado com sucesso')
      await loadPools()
    } catch (error: any) {
      console.error('Erro ao fechar pool:', error)
      toast.error('Erro ao fechar pool')
    }
  }

  async function updateEarningStatus(earningId: string, status: string) {
    try {
      const updateData: any = { status }
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('creator_earnings')
        .update(updateData)
        .eq('id', earningId)

      if (error) throw error

      toast.success('Status atualizado com sucesso')
      await loadEarnings()
      await loadStats()
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  async function refreshPool() {
    setRefreshing(true)
    try {
      const { data, error } = await supabase.rpc('update_revenue_pool_from_subscriptions')
      if (error) throw error

      if (data && data.length > 0) {
        const result = data[0]
        if (result.success) {
          toast.success(result.message || 'Pool atualizado com sucesso')
        } else {
          toast.error(result.message || 'Erro ao atualizar pool')
        }
      } else {
        toast.success('Pool atualizado com sucesso')
      }

      await loadPools()
      await loadStats()
      await loadEarnings()
    } catch (error: any) {
      console.error('Erro ao atualizar pool:', error)
      toast.error(error.message || 'Erro ao atualizar pool')
    } finally {
      setRefreshing(false)
    }
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

  // Verificar se stats está carregado antes de renderizar
  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Carregando dados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comissões</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie o Revenue Pool e comissões dos criadores</p>
        </div>
        <Button
          onClick={refreshPool}
          disabled={refreshing}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          <span>Atualizar Pool</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Visão Geral', icon: BarChart3 },
            { id: 'pools', name: 'Revenue Pools', icon: DollarSign },
            { id: 'earnings', name: 'Comissões', icon: TrendingUp },
            { id: 'creators', name: 'Criadores', icon: User }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Comissões</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats?.totalEarnings || 0)}
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
                <p className="text-sm font-medium text-gray-500">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">
                  {formatCurrency(stats?.pendingEarnings || 0)}
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
                <p className="text-sm font-medium text-gray-500">Pagas</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {formatCurrency(stats?.paidEarnings || 0)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Criadores Ativos</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats?.totalCreators || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          {/* Current Pool Info */}
          {stats?.currentPool && (
            <Card className={cn(
              "p-6 col-span-full",
              stats.currentPool.total_revenue === 0 && "border-yellow-300 bg-yellow-50"
            )}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Pool Atual ({stats.currentPool.month_year})</h3>
                {stats.currentPool.total_revenue === 0 && (
                  <div className="flex items-center space-x-2 text-yellow-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Pool zerado - Clique em "Atualizar Pool" para carregar receita</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Receita Total</p>
                  <p className={cn(
                    "text-xl font-bold mt-1",
                    stats.currentPool.total_revenue === 0 ? "text-yellow-600" : "text-gray-900"
                  )}>
                    {formatCurrency(stats.currentPool.total_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Comissão Premium</p>
                  <p className="text-xl font-bold text-primary-600 mt-1">
                    {formatCurrency(stats.currentPool.premium_commission_amount || 0.40)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Comissão Grátis</p>
                  <p className="text-xl font-bold text-gray-600 mt-1">
                    {formatCurrency(stats.currentPool.free_commission_amount || 0.06)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Downloads</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {stats.currentPool.total_downloads}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Distribuído</p>
                  <p className="text-xl font-bold text-primary-600 mt-1">
                    {formatCurrency(stats.currentPool.distributed_amount)}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Pools Tab */}
      {activeTab === 'pools' && (
        <div className="space-y-4">
          {pools.map((pool) => (
            <Card key={pool.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatMonthYear(pool.month_year)}
                    </h3>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      pool.status === 'active' && "bg-green-100 text-green-700",
                      pool.status === 'closed' && "bg-gray-100 text-gray-700",
                      pool.status === 'distributed' && "bg-blue-100 text-blue-700"
                    )}>
                      {pool.status === 'active' ? 'Ativo' : pool.status === 'closed' ? 'Fechado' : 'Distribuído'}
                    </span>
                  </div>

                  {editingPool === pool.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Receita Total (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={poolFormData.total_revenue}
                          onChange={(e) => setPoolFormData({
                            ...poolFormData,
                            total_revenue: parseFloat(e.target.value) || 0
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Defina manualmente a receita do pool se necessário. Ao salvar, as comissões serão recalculadas automaticamente.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comissão Premium (R$)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={poolFormData.premium_commission_amount}
                            onChange={(e) => setPoolFormData({
                              ...poolFormData,
                              premium_commission_amount: parseFloat(e.target.value) || 0
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-1">Por download premium</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Comissão Grátis (R$)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={poolFormData.free_commission_amount}
                            onChange={(e) => setPoolFormData({
                              ...poolFormData,
                              free_commission_amount: parseFloat(e.target.value) || 0
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-1">Por download grátis</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Percentual de Comissão (%) - Legado
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={poolFormData.commission_percentage}
                          onChange={(e) => setPoolFormData({
                            ...poolFormData,
                            commission_percentage: parseFloat(e.target.value)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Mantido para compatibilidade (não usado em valores fixos)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações
                        </label>
                        <textarea
                          value={poolFormData.notes}
                          onChange={(e) => setPoolFormData({
                            ...poolFormData,
                            notes: e.target.value
                          })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => updatePool(pool.id)}
                          size="sm"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                          <Button
                            onClick={() => {
                              setEditingPool(null)
                              setPoolFormData({ total_revenue: 0, commission_percentage: 30, premium_commission_amount: 0.40, free_commission_amount: 0.06, notes: '' })
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Receita Total</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            {formatCurrency(pool.total_revenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Comissão Premium</p>
                          <p className="text-lg font-semibold text-primary-600 mt-1">
                            {formatCurrency(pool.premium_commission_amount || 0.40)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Comissão Grátis</p>
                          <p className="text-lg font-semibold text-gray-600 mt-1">
                            {formatCurrency(pool.free_commission_amount || 0.06)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Distribuído</p>
                          <p className="text-lg font-semibold text-primary-600 mt-1">
                            {formatCurrency(pool.distributed_amount)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Downloads</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            {pool.total_downloads}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Tipo</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            {pool.commission_type === 'fixed' ? 'Valores Fixos' : 'Revenue Pool'}
                          </p>
                        </div>
                      </div>
                      {pool.notes && (
                        <p className="text-sm text-gray-600 mb-4">{pool.notes}</p>
                      )}
                      <div className="flex items-center space-x-2">
                        {pool.status === 'active' && (
                          <>
                            <Button
                              onClick={() => {
                            setEditingPool(pool.id)
                            setPoolFormData({
                              total_revenue: pool.total_revenue,
                              commission_percentage: pool.commission_percentage,
                              premium_commission_amount: pool.premium_commission_amount || 0.40,
                              free_commission_amount: pool.free_commission_amount || 0.06,
                              notes: pool.notes || ''
                            })
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              onClick={() => closePool(pool.id, pool.month_year)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              Fechar Pool
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Earnings Tab */}
      {activeTab === 'earnings' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por criador ou recurso..."
                    value={earningSearch}
                    onChange={(e) => setEarningSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={earningStatusFilter}
                onChange={(e) => setEarningStatusFilter(e.target.value as EarningStatus)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="processing">Processando</option>
              </select>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </Card>

          {/* Earnings List */}
          <div className="space-y-2">
            {earnings.map((earning) => (
              <Card key={earning.id} className="p-4">
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
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Criador: {earning.creator?.full_name || earning.creator?.email || 'N/A'}</span>
                      <span>•</span>
                      <span>{formatDate(earning.created_at)}</span>
                      <span>•</span>
                      <span>{earning.month_year}</span>
                    </div>
                    {earning.commission_per_download && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatCurrency(earning.commission_per_download)} por download
                        {earning.downloads_in_pool && ` • ${earning.downloads_in_pool} downloads no pool`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(earning.amount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {earning.commission_rate}% do pool
                      </p>
                    </div>
                    {earning.status === 'pending' && (
                      <Button
                        onClick={() => updateEarningStatus(earning.id, 'paid')}
                        size="sm"
                        variant="outline"
                      >
                        Marcar como Pago
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Creators Tab */}
      {activeTab === 'creators' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas por Criador</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Criador</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Pendente</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Pago</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {creatorStats.map((stat: any) => (
                    <tr key={stat.creator_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {stat.creator?.full_name || stat.creator?.email || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">{stat.creator?.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(stat.total)}
                      </td>
                      <td className="py-3 px-4 text-right text-yellow-600">
                        {formatCurrency(stat.pending)}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600">
                        {formatCurrency(stat.paid)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {stat.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}


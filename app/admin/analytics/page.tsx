'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import { BarChart3, TrendingUp, Users, Download, Eye, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalViews: 0,
    totalDownloads: 0,
    totalUsers: 0,
    totalCreators: 0,
    premiumUsers: 0,
  })
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      // Get all resources for view/download counts
      const { data: resources } = await supabase
        .from('resources')
        .select('view_count, download_count')

      const totalViews = resources?.reduce((acc, curr) => acc + (curr.view_count || 0), 0) || 0
      const totalDownloads = resources?.reduce((acc, curr) => acc + (curr.download_count || 0), 0) || 0

      // Get user counts
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      const { count: totalCreators } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_creator', true)

      setStats({
        totalViews,
        totalDownloads,
        totalUsers: totalUsers || 0,
        totalCreators: totalCreators || 0,
        premiumUsers: 0, // Placeholder for now
      })
    } catch (error: any) {
      toast.error('Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Relatórios de Performance</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe o crescimento e o engajamento da plataforma.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          Carregando relatórios...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnalyticCard title="Visualizações Totais" value={stats.totalViews.toLocaleString()} icon={Eye} color="blue" />
            <AnalyticCard title="Downloads Totais" value={stats.totalDownloads.toLocaleString()} icon={Download} color="green" />
            <AnalyticCard title="Total de Membros" value={stats.totalUsers.toLocaleString()} icon={Users} color="purple" />
            <AnalyticCard title="Total de Criadores" value={stats.totalCreators.toLocaleString()} icon={TrendingUp} color="primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
              <BarChart3 className="h-12 w-12 text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">Gráfico de Downloads</h3>
              <p className="text-gray-500 text-sm max-w-xs mt-2">Os gráficos detalhados de evolução temporal estarão disponíveis em breve.</p>
            </Card>

            <Card className="border-none p-8 bg-gray-900 text-white rounded-[2rem]">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-primary-500/20 flex items-center justify-center text-primary-500">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Faturamento Estimado</h3>
                  <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Mês Atual</p>
                </div>
              </div>
              <p className="text-5xl font-bold tracking-tighter mb-4">R$ 0,00</p>
              <p className="text-primary-500/60 text-sm font-medium">Aguardando as primeiras transações premium para gerar relatórios financeiros.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-gray-900',
    purple: 'bg-purple-50 text-purple-600',
    primary: 'bg-primary-50 text-primary-600',
  }
  return (
    <Card className="border-none p-6 flex flex-col gap-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-bold text-gray-900 tracking-tighter mt-1">{value}</p>
      </div>
    </Card>
  )
}


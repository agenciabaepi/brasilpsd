'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload, FileCheck, FileX, TrendingUp, DollarSign, Eye, Clock, Files } from 'lucide-react'
import type { Profile, Resource } from '@/types/database'
import Link from 'next/link'
import { getS3Url } from '@/lib/aws/s3'

export default function CreatorDashboardPage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [stats, setStats] = useState({
    totalResources: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalDownloads: 0,
    totalViews: 0,
  })
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      router.push('/login')
      return
    }

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    
    if (!profile || (!profile.is_creator && !profile.is_admin)) {
      router.push('/dashboard')
      return
    }

    setUser(profile)

    // Load resources
    const { data: resourcesData } = await supabase
      .from('resources')
      .select('*')
      .eq('creator_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setResources(resourcesData || [])

    // Calculate stats
    const { data: allResources } = await supabase
      .from('resources')
      .select('status, download_count, view_count')
      .eq('creator_id', authUser.id)

    const statsData = {
      totalResources: allResources?.length || 0,
      pending: allResources?.filter(r => r.status === 'pending').length || 0,
      approved: allResources?.filter(r => r.status === 'approved').length || 0,
      rejected: allResources?.filter(r => r.status === 'rejected').length || 0,
      totalDownloads: allResources?.reduce((sum, r) => sum + (r.download_count || 0), 0) || 0,
      totalViews: allResources?.reduce((sum, r) => sum + (r.view_count || 0), 0) || 0,
    }

    setStats(statsData)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-semibold tracking-widest text-[10px] uppercase">Carregando Painel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-2">
          <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Painel do Criador</h1>
          <p className="text-gray-400 font-medium text-sm tracking-wider">Acompanhe seu desempenho e envie novos arquivos.</p>
        </div>
        <Link href="/creator/upload">
          <Button className="bg-primary-500 hover:bg-primary-600 rounded-2xl px-8 h-14 border-none font-semibold tracking-tighter uppercase">
            <Upload className="mr-3 h-5 w-5" />
            Enviar Novo
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CreatorStatCard title="Arquivos" value={stats.totalResources} icon={Files} color="primary" />
        <CreatorStatCard title="Downloads" value={stats.totalDownloads} icon={TrendingUp} color="primary" />
        <CreatorStatCard title="Pendentes" value={stats.pending} icon={Clock} color="primary" />
        <CreatorStatCard title="Visualizações" value={stats.totalViews} icon={Eye} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none overflow-hidden p-0">
            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 tracking-tight text-sm">Envios Recentes</h3>
              <Link href="/creator/resources" className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest hover:text-primary-600">Ver Tudo</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {resources.length > 0 ? (
                resources.map((resource) => (
                  <div key={resource.id} className="px-8 py-5 flex items-center space-x-4 hover:bg-gray-50 transition-colors">
                    <div className="h-14 w-14 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden">
                      {resource.thumbnail_url && <img src={getS3Url(resource.thumbnail_url)} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate tracking-tight">{resource.title}</p>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded uppercase ${
                          resource.status === 'approved' ? 'bg-green-50 text-green-600' :
                          resource.status === 'pending' ? 'bg-primary-50 text-primary-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {resource.status}
                        </span>
                        <span className="text-[10px] font-medium text-gray-300 tracking-tighter">
                          {new Date(resource.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 tracking-tighter">{resource.download_count}</p>
                      <p className="text-[9px] font-medium text-gray-400 uppercase tracking-widest">Downloads</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-20 text-center">
                  <p className="text-gray-300 font-medium uppercase text-xs">Nenhum arquivo enviado</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-900 border-none p-8 text-white rounded-[2rem]">
            <h3 className="font-semibold tracking-tight text-xl mb-4 text-primary-500 uppercase">Saldo Atual</h3>
            <p className="text-4xl font-semibold tracking-tighter mb-2">R$ 0,00</p>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mb-8">Disponível para saque em breve</p>
            <button className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl font-semibold uppercase text-xs tracking-widest transition-all">
              Configurar Saques
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CreatorStatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    primary: 'bg-primary-50 text-primary-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card className="border-none flex items-center space-x-4 p-6 hover:translate-y-[-4px] transition-all">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-semibold text-gray-900 tracking-tighter leading-none mt-1">{value}</p>
      </div>
    </Card>
  )
}

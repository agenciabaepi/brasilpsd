'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Users, FileCheck, FileX, TrendingUp, DollarSign, AlertCircle } from 'lucide-react'
import type { Profile, Resource } from '@/types/database'
import Link from 'next/link'
import { getS3Url } from '@/lib/aws/s3'
import toast from 'react-hot-toast'

export default function AdminDashboardPage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [pendingResources, setPendingResources] = useState<Resource[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCreators: 0,
    totalResources: 0,
    pendingResources: 0,
    pendingCollections: 0,
    totalDownloads: 0,
  })
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        console.error('Erro de autenticação:', authError)
        router.push('/login')
        return
      }

      // Load profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (profileError || !profile || !profile.is_admin) {
        console.error('Erro de perfil ou não é admin:', profileError)
        // Se a tabela de perfis estiver vazia ou o perfil não existir, 
        // talvez o trigger de criação não tenha rodado.
        toast.error('Acesso negado ou perfil não encontrado.')
        router.push('/dashboard')
        return
      }

      setUser(profile)

      // Executar buscas em paralelo para performance
      const [
        { data: pendingData },
        { count: usersCount },
        { count: creatorsCount },
        { count: resourcesCount },
        { count: pendingCount },
        { count: pendingCollectionsCount },
        { data: downloadData }
      ] = await Promise.all([
        supabase.from('resources').select('*, creator:profiles!creator_id(*)').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_creator', true),
        supabase.from('resources').select('*', { count: 'exact', head: true }),
        supabase.from('resources').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('collections').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('resources').select('download_count')
      ])

      setPendingResources(pendingData || [])

      const totalDownloads = downloadData?.reduce((sum, r) => sum + (r.download_count || 0), 0) || 0

      setStats({
        totalUsers: usersCount || 0,
        totalCreators: creatorsCount || 0,
        totalResources: resourcesCount || 0,
        pendingResources: pendingCount || 0,
        pendingCollections: pendingCollectionsCount || 0,
        totalDownloads,
      })
    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error)
      toast.error('Erro ao sincronizar dados. Verifique sua conexão ou banco de dados.')
    }
  }

  async function handleApprove(resourceId: string) {
    // Buscar dados do recurso antes de aprovar
    const { data: resource } = await supabase
      .from('resources')
      .select(`
        *,
        creator:profiles!creator_id(email, full_name)
      `)
      .eq('id', resourceId)
      .single()

    if (!resource) {
      alert('Recurso não encontrado')
      return
    }

    const { error } = await supabase
      .from('resources')
      .update({ 
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', resourceId)

    if (error) {
      alert('Erro ao aprovar recurso')
      return
    }

    // Enviar email ao criador (via API route para evitar problemas com nodemailer no cliente)
    if (resource.creator && resource.creator.email) {
      try {
        await fetch('/api/admin/notify-resource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId,
            action: 'approved'
          })
        }).catch(() => {
          // Ignorar erros de email (não bloquear aprovação)
        })
      } catch (emailError) {
        console.error('Erro ao enviar email de aprovação:', emailError)
        // Não bloquear a aprovação se o email falhar
      }
    }

    loadData()
  }

  async function handleReject(resourceId: string, reason: string) {
    const reasonText = prompt('Digite o motivo da rejeição:', reason)
    if (!reasonText) return

    // Buscar dados do recurso antes de rejeitar
    const { data: resource } = await supabase
      .from('resources')
      .select(`
        *,
        creator:profiles!creator_id(email, full_name)
      `)
      .eq('id', resourceId)
      .single()

    if (!resource) {
      alert('Recurso não encontrado')
      return
    }

    const { error } = await supabase
      .from('resources')
      .update({ 
        status: 'rejected',
        rejected_reason: reasonText,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', resourceId)

    if (error) {
      alert('Erro ao rejeitar recurso')
      return
    }

    // Enviar email ao criador (via API route para evitar problemas com nodemailer no cliente)
    if (resource.creator && resource.creator.email) {
      try {
        await fetch('/api/admin/notify-resource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId,
            action: 'rejected',
            reason: reasonText
          })
        }).catch(() => {
          // Ignorar erros de email (não bloquear rejeição)
        })
      } catch (emailError) {
        console.error('Erro ao enviar email de rejeição:', emailError)
        // Não bloquear a rejeição se o email falhar
      }
    }

    loadData()
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-semibold tracking-widest text-xs uppercase">Sincronizando Dados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Painel Administrativo</h1>
        <p className="text-gray-500 font-medium">Bem-vindo à central de gestão do BrasilPSD.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <StatCard title="Total de Usuários" value={stats.totalUsers} icon={Users} color="blue" />
        <StatCard title="Criadores" value={stats.totalCreators} icon={Users} color="purple" />
        <StatCard title="Total de Recursos" value={stats.totalResources} icon={FileCheck} color="green" />
        <StatCard title="Recursos Pendentes" value={stats.pendingResources} icon={AlertCircle} color="orange" />
        <StatCard title="Coleções Pendentes" value={stats.pendingCollections} icon={FileCheck} color="orange" />
        <StatCard title="Total Downloads" value={stats.totalDownloads} icon={TrendingUp} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Resources */}
        <div className="lg:col-span-2">
          <Card className="border-none overflow-hidden p-0">
            <div className="bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 tracking-tight text-sm">
                Recursos Aguardando Aprovação
              </h2>
              <span className="bg-orange-100 text-orange-600 text-[10px] font-semibold px-2 py-1 rounded-md uppercase">
                {pendingResources.length} Pendentes
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingResources.length > 0 ? (
                pendingResources.map((resource) => (
                  <div key={resource.id} className="p-6 flex items-center space-x-4 hover:bg-gray-50 transition-colors">
                    <div className="h-16 w-16 rounded-xl bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden">
                      {resource.thumbnail_url ? (
                        <img src={getS3Url(resource.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                          <FileCheck className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate tracking-tight">
                        {resource.title}
                      </h3>
                      <div className="flex items-center space-x-3 mt-1 text-[11px] font-semibold text-gray-400 tracking-wider uppercase">
                        <span>{(resource as any).creator?.full_name}</span>
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        <span>{resource.resource_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleApprove(resource.id)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-semibold rounded-lg transition-all uppercase"
                      >
                        Aprovar
                      </button>
                      <button 
                        onClick={() => handleReject(resource.id, '')}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-500 text-[10px] font-semibold rounded-lg transition-all uppercase"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-gray-400 font-semibold text-xs tracking-widest uppercase">
                  Tudo limpo por aqui!
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="space-y-6">
          <Card className="bg-primary-500 border-none p-8 text-white">
            <h3 className="font-semibold text-xl mb-2 uppercase">Acesso Rápido</h3>
            <p className="text-primary-100 text-sm font-medium mb-6">Acesse as ferramentas de gestão do sistema.</p>
            <div className="space-y-3">
              <QuickLink href="/admin/users" title="Gestão de Usuários" />
              <QuickLink href="/admin/resources" title="Biblioteca de Arquivos" />
              <QuickLink href="/admin/analytics" title="Relatórios de Performance" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-gray-900',
    orange: 'bg-orange-50 text-orange-600',
    primary: 'bg-primary-50 text-primary-600',
  }
  return (
    <Card className="border-none flex items-center space-x-4 p-6">
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

function QuickLink({ href, title }: { href: string, title: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 group"
    >
      <span className="text-xs font-semibold uppercase tracking-tight">{title}</span>
      <TrendingUp className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all" />
    </Link>
  )
}

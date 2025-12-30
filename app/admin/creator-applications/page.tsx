'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Clock, ExternalLink, User as UserIcon } from 'lucide-react'
import type { Profile } from '@/types/database'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CreatorApplication {
  id: string
  user_id: string
  portfolio_url: string
  is_contributor_on_other_platform: boolean
  other_platform_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejected_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  user?: Profile
}

export default function CreatorApplicationsPage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [applications, setApplications] = useState<CreatorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    checkAdminAndLoad()
  }, [filter])

  async function checkAdminAndLoad() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (!profile || !profile.is_admin) {
        toast.error('Acesso negado. Apenas administradores podem acessar esta página.')
        router.push('/dashboard')
        return
      }

      setUser(profile)
      await loadApplications()
    } catch (error: any) {
      console.error('Erro ao verificar admin:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function loadApplications() {
    try {
      let query = supabase
        .from('creator_applications')
        .select(`
          *,
          user:profiles!user_id(*)
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setApplications(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar solicitações:', error)
      toast.error('Erro ao carregar solicitações')
    }
  }

  async function handleApprove(applicationId: string) {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const response = await fetch(`/api/admin/creator-applications/${applicationId}/approve`, {
        method: 'PUT',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aprovar solicitação')
      }

      toast.success('Solicitação aprovada com sucesso!')
      await loadApplications()
    } catch (error: any) {
      console.error('Erro ao aprovar:', error)
      toast.error(error.message || 'Erro ao aprovar solicitação')
    }
  }

  async function handleReject(applicationId: string) {
    const rejectReason = rejectReasons[applicationId] || ''
    
    try {
      setRejectingId(applicationId)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const response = await fetch(`/api/admin/creator-applications/${applicationId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejected_reason: rejectReason.trim() || null }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao rejeitar solicitação')
      }

      toast.success('Solicitação rejeitada')
      setRejectReasons(prev => {
        const next = { ...prev }
        delete next[applicationId]
        return next
      })
      setRejectingId(null)
      await loadApplications()
    } catch (error: any) {
      console.error('Erro ao rejeitar:', error)
      toast.error(error.message || 'Erro ao rejeitar solicitação')
    } finally {
      setRejectingId(null)
    }
  }

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true
    return app.status === filter
  })

  const stats = {
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    total: applications.length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Solicitações de Criadores
        </h1>
        <p className="text-gray-600">
          Gerencie e revise as solicitações para se tornar criador
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <UserIcon className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aprovadas</p>
              <p className="text-2xl font-bold text-primary-600">{stats.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-primary-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejeitadas</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={filter === 'all' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Todas
        </Button>
        <Button
          variant={filter === 'pending' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('pending')}
        >
          Pendentes ({stats.pending})
        </Button>
        <Button
          variant={filter === 'approved' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('approved')}
        >
          Aprovadas ({stats.approved})
        </Button>
        <Button
          variant={filter === 'rejected' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('rejected')}
        >
          Rejeitadas ({stats.rejected})
        </Button>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 font-medium">
              Nenhuma solicitação encontrada
            </p>
          </Card>
        ) : (
          filteredApplications.map((application) => (
            <Card key={application.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {application.user?.full_name || application.user?.email || 'Usuário'}
                      </h3>
                      <p className="text-sm text-gray-500">{application.user?.email}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        application.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : application.status === 'approved'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {application.status === 'pending'
                        ? 'Pendente'
                        : application.status === 'approved'
                        ? 'Aprovado'
                        : 'Rejeitado'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Portfólio:</p>
                      <a
                        href={application.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        {application.portfolio_url}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    {application.is_contributor_on_other_platform && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Contribuidor em outra plataforma:
                        </p>
                        <p className="text-gray-600">
                          {application.other_platform_name || 'Não especificado'}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-gray-700">Data da solicitação:</p>
                      <p className="text-gray-600">
                        {format(new Date(application.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>

                    {application.status === 'rejected' && application.rejected_reason && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Motivo da rejeição:</p>
                        <p className="text-gray-600">{application.rejected_reason}</p>
                      </div>
                    )}

                    {application.status === 'approved' && application.reviewed_at && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Aprovado em:</p>
                        <p className="text-gray-600">
                          {format(new Date(application.reviewed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {application.status === 'pending' && (
                  <div className="ml-6 flex flex-col gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(application.id)}
                      className="whitespace-nowrap"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprovar
                    </Button>
                    
                    <div className="space-y-2">
                      <textarea
                        placeholder="Motivo da rejeição (opcional)"
                        value={rejectReasons[application.id] || ''}
                        onChange={(e) => setRejectReasons(prev => ({
                          ...prev,
                          [application.id]: e.target.value
                        }))}
                        className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
                        rows={3}
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleReject(application.id)}
                        disabled={rejectingId === application.id}
                        isLoading={rejectingId === application.id}
                        className="w-full"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}


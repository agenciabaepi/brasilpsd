'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload, User, Save, LogOut, CreditCard, Download, Heart, Users, Gift, MessageCircle, Mail, ChevronDown, ChevronUp, LayoutDashboard, Sparkles, RefreshCw, Info, FileText, Video, Image as ImageIcon, Music, FileImage, Package, Menu, X } from 'lucide-react'
import Link from 'next/link'
import type { Profile, Download as DownloadType, Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'
import { formatPlanName, getDownloadLimitByPlan } from '@/lib/utils/download-helpers'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [user, setUser] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    // Informações pessoais
    full_name: '',
    email: '',
    cpf_cnpj: '',
    phone: '',
    birth_date: '',
    // Endereço
    postal_code: '',
    city: '',
    state: '',
    address: '',
    address_number: '',
    neighborhood: '',
    // Senha
    new_password: '',
    confirm_password: '',
  })

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ]

  const [activeSection, setActiveSection] = useState<'account' | 'subscriptions' | 'downloads' | 'favorites' | 'saved' | 'following' | 'affiliate'>('account')
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [refreshingTransactions, setRefreshingTransactions] = useState(false)
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [showAllSubscriptions, setShowAllSubscriptions] = useState(false)
  
  // Estados para downloads
  const [downloads, setDownloads] = useState<DownloadType[]>([])
  const [loadingDownloads, setLoadingDownloads] = useState(false)
  const [refreshingDownloads, setRefreshingDownloads] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<{
    current: number
    limit: number
    remaining: number
    plan: string
  } | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const TRANSACTIONS_LIMIT = 5
  const SUBSCRIPTIONS_LIMIT = 3

  const menuItems = [
    { id: 'account', name: 'Minha conta', icon: User },
    { id: 'subscriptions', name: 'Assinaturas', icon: CreditCard },
    { id: 'downloads', name: 'Downloads', icon: Download },
    { id: 'favorites', name: 'Curtidas', icon: Heart },
    { id: 'saved', name: 'Salvos', icon: Heart },
    { id: 'following', name: 'Seguindo', icon: Users },
    { id: 'affiliate', name: 'Afiliado', icon: Gift },
  ]

  useEffect(() => {
    loadUser()
  }, [])

  // Carregar downloads e status quando a seção for selecionada
  useEffect(() => {
    if (activeSection === 'downloads' && user) {
      loadDownloads()
      loadDownloadStatus()
    }
  }, [activeSection, user])

  // Fechar menu mobile ao mudar de seção
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [activeSection])

  // Prevenir scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  // Função para gerar ID de licença único baseado no download
  function generateLicenseId(downloadId: string, downloadedAt: string): string {
    const timestamp = new Date(downloadedAt).getTime()
    const idHash = downloadId.split('-').join('').substring(0, 10)
    const timestampStr = timestamp.toString().slice(-15)
    return `#${timestampStr}${idHash}`
  }

  // Função para obter ícone e label do tipo de recurso
  function getResourceTypeInfo(resourceType: string) {
    const types: Record<string, { icon: typeof Package, label: string }> = {
      video: { icon: Video, label: 'MOTION' },
      image: { icon: ImageIcon, label: 'FILE' },
      png: { icon: FileImage, label: 'FILE' },
      font: { icon: FileText, label: 'FILE' },
      psd: { icon: FileText, label: 'FILE' },
      ai: { icon: FileText, label: 'FILE' },
      audio: { icon: Music, label: 'AUDIO' },
      other: { icon: Package, label: 'FILE' }
    }
    return types[resourceType] || types.other
  }

  async function loadDownloads() {
    if (loadingDownloads) return
    setLoadingDownloads(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setLoadingDownloads(false)
        return
      }

      const { data, error } = await supabase
        .from('downloads')
        .select(`
          *,
          resource:resources(
            *,
            creator:profiles!creator_id(id, full_name, avatar_url),
            category:categories!category_id(id, name, slug)
          )
        `)
        .eq('user_id', authUser.id)
        .order('downloaded_at', { ascending: false })

      if (error) {
        console.error('Erro na query de downloads:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }
      
      console.log('Downloads carregados:', data?.length || 0)
      setDownloads(data || [])
    } catch (error: any) {
      console.error('Erro completo ao carregar downloads:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint
      })
      toast.error(error?.message || error?.details || 'Erro ao carregar downloads. Verifique o console para mais detalhes.')
    } finally {
      setLoadingDownloads(false)
    }
  }

  async function loadDownloadStatus() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const response = await fetch('/api/downloads/status')
      if (response.ok) {
        const status = await response.json()
        setDownloadStatus(status)
      }
    } catch (error) {
      console.error('Erro ao carregar status de downloads:', error)
    }
  }

  async function handleRefreshDownloads() {
    setRefreshingDownloads(true)
    await Promise.all([loadDownloads(), loadDownloadStatus()])
    setRefreshingDownloads(false)
    toast.success('Downloads atualizados')
  }

  // Atualizar status das transações verificando no Asaas
  async function refreshTransactionsStatus() {
    setRefreshingTransactions(true)
    try {
      const res = await fetch('/api/finance/refresh-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()

      if (res.ok && data.transactions) {
        // Atualizar transações com os dados atualizados
        setTransactions(prev => {
          const updated = [...prev]
          data.transactions.forEach((updatedTx: any) => {
            const index = updated.findIndex(t => t.id === updatedTx.id)
            if (index !== -1) {
              updated[index] = { ...updated[index], ...updatedTx }
            }
          })
          return updated
        })

        // Se alguma transação foi atualizada para 'paid', recarregar dados do usuário
        if (data.updated > 0) {
          await loadUser()
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar status das transações:', error)
    } finally {
      setRefreshingTransactions(false)
    }
  }

  async function loadUser() {
    setLoading(true)
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        console.error('Erro de autenticação:', authError)
        router.push('/login')
        return
      }

      // Buscar perfil e assinatura em paralelo
      const [profileResult, subscriptionResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single(),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      const { data: profile, error } = profileResult
      const { data: activeSubscription } = subscriptionResult

      // Se tem assinatura, buscar detalhes completos e transações
      if (activeSubscription) {
        // Buscar TODAS as assinaturas do usuário (ativas, expiradas, canceladas)
        const { data: allUserSubscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
        
        // Buscar transações relacionadas
        const { data: subscriptionTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
        
        setSubscriptionDetails(activeSubscription)
        setAllSubscriptions(allUserSubscriptions || [])
        setTransactions(subscriptionTransactions || [])
        
        // Verificar status dos pagamentos no Asaas (não bloquear o carregamento)
        refreshTransactionsStatus().catch(err => {
          console.error('Erro ao atualizar transações (não crítico):', err)
        })
      } else {
        setSubscriptionDetails(null)
        setTransactions([])
        
        // Mesmo sem assinatura ativa, buscar todas as assinaturas e transações
        const { data: allUserSubscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
        
        const { data: subscriptionTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
        
        setAllSubscriptions(allUserSubscriptions || [])
        setTransactions(subscriptionTransactions || [])
      }
  
      if (error) {
        console.error('Erro ao buscar perfil:', error)
        // Se o perfil não existe, criar um básico
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.user_metadata?.full_name || null,
            })
            .select()
            .single()
  
          if (createError) {
            console.error('Erro ao criar perfil:', createError)
            throw createError
          }
          
          setUser(newProfile)
          setSubscription(null)
          setFormData({
            full_name: newProfile.full_name || '',
            email: newProfile.email || '',
            cpf_cnpj: '',
            phone: '',
            birth_date: '',
            postal_code: '',
            city: '',
            state: '',
            address: '',
            address_number: '',
            neighborhood: '',
            new_password: '',
            confirm_password: '',
          })
        } else {
          throw error
        }
      } else if (profile) {
        setUser(profile)
        setSubscription(activeSubscription || null)
        setFormData({
          full_name: profile.full_name || '',
          email: profile.email || '',
          cpf_cnpj: profile.cpf_cnpj || '',
          phone: profile.phone || '',
          birth_date: profile.birth_date ? format(new Date(profile.birth_date), 'yyyy-MM-dd') : '',
          postal_code: profile.postal_code || '',
          city: profile.city || '',
          state: profile.state || '',
          address: profile.address || '',
          address_number: profile.address_number || '',
          neighborhood: profile.neighborhood || '',
          new_password: '',
          confirm_password: '',
        })
      }
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error)
      toast.error('Erro ao carregar perfil: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'avatar')

      const res = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao fazer upload')

      toast.success('Foto atualizada com sucesso!')
      await loadUser()
    } catch (error: any) {
      console.error('Erro no upload:', error)
      toast.error(error.message || 'Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!user) return

    // Validar senha se fornecida
    if (formData.new_password) {
      if (formData.new_password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres')
        return
      }
      if (formData.new_password !== formData.confirm_password) {
        toast.error('As senhas não coincidem')
        return
      }
    }

    setSaving(true)
    try {
      // Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          cpf_cnpj: formData.cpf_cnpj || null,
          phone: formData.phone || null,
          birth_date: formData.birth_date || null,
          postal_code: formData.postal_code || null,
          city: formData.city || null,
          state: formData.state || null,
          address: formData.address || null,
          address_number: formData.address_number || null,
          neighborhood: formData.neighborhood || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Atualizar senha se fornecida
      if (formData.new_password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.new_password
        })

        if (passwordError) throw passwordError
      }

      toast.success('Perfil atualizado com sucesso!')
      await loadUser()
      
      // Limpar campos de senha
      setFormData(prev => ({
        ...prev,
        new_password: '',
        confirm_password: ''
      }))
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      toast.error(error.message || 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erro ao fazer logout')
      return
    }
    // Usar window.location para garantir limpeza completa do estado
    window.location.href = '/'
  }

  // Buscar CEP (opcional - integração com API de CEP)
  async function handleCepBlur() {
    if (formData.postal_code.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${formData.postal_code}/json/`)
        const data = await res.json()
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood
          }))
        }
      } catch (error) {
        // Silenciar erro - CEP pode não ser encontrado
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 font-semibold">Erro ao carregar perfil</p>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-[#F8F9FA] py-4 lg:py-8">
      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6 text-gray-700" />
          ) : (
            <Menu className="h-6 w-6 text-gray-700" />
          )}
        </button>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col lg:flex-row overflow-hidden">
          {/* Sidebar dentro do container */}
          <aside className={cn(
            "w-full lg:w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-transform duration-300 lg:translate-x-0",
            "fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-4">
            Acesso rápido
          </h3>
          {menuItems.map((item) => {
            const isActive = activeSection === item.id
            // Redirecionar para páginas específicas quando necessário
            const handleClick = () => {
              setIsMobileMenuOpen(false)
              if (item.id === 'favorites') {
                router.push('/favorites')
              } else if (item.id === 'saved') {
                router.push('/saved')
              } else if (item.id === 'following') {
                router.push('/following')
              } else if (item.id === 'affiliate') {
                router.push('/affiliate')
              } else {
                setActiveSection(item.id as any)
              }
            }
            
            return (
              <button
                key={item.id}
                onClick={handleClick}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left",
                  isActive 
                    ? "bg-primary-50 text-primary-600" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary-600" : "text-gray-400")} />
                <span>{item.name}</span>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-gray-200 p-4 space-y-1">
          {/* Suporte */}
          <div className="space-y-2">
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
            >
              <MessageCircle className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold">Suporte por WhatsApp</p>
                <p className="text-[10px] text-gray-400">Dúvidas e perguntas</p>
              </div>
            </a>
            <a
              href="mailto:suporte@brasilpsd.com"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
            >
              <Mail className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold">Formulário de e-mail</p>
                <p className="text-[10px] text-gray-400">Resolver problemas</p>
              </div>
            </a>
          </div>
        </div>
      </aside>

          {/* Conteúdo principal */}
          <div className="flex-1 overflow-y-auto w-full">
            <div className="p-4 lg:p-10">
              {/* Header do Usuário - Sempre visível */}
              <Card className="mb-6 lg:mb-8 p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-3 lg:space-x-4">
                    <div className="relative h-12 w-12 lg:h-16 lg:w-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex-shrink-0">
                      {user.avatar_url ? (
                        <Image
                          src={getS3Url(user.avatar_url)}
                          alt={user.full_name || 'Avatar'}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-secondary-500 to-primary-500">
                          <User className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                        <h3 className="text-base lg:text-lg font-semibold text-gray-900 truncate">{user.full_name || 'Usuário'}</h3>
                        {user.is_premium && subscription && (
                          <span className={cn(
                            "text-[10px] lg:text-xs font-bold px-2 lg:px-3 py-1 rounded-full uppercase tracking-wider flex-shrink-0",
                            subscription.tier === 'lite' ? "bg-blue-100 text-blue-700" :
                            subscription.tier === 'pro' ? "bg-primary-100 text-primary-700" :
                            "bg-purple-100 text-purple-700"
                          )}>
                            Premium {subscription.tier.toUpperCase()}
                          </span>
                        )}
                        {user.is_creator && (
                          <span className="text-[10px] lg:text-xs font-bold px-2 lg:px-3 py-1 rounded-full uppercase tracking-wider bg-purple-100 text-purple-700 flex-shrink-0">
                            Criador
                          </span>
                        )}
                      </div>
                      <p className="text-xs lg:text-sm text-gray-500 truncate">{user.email}</p>
                      {subscription && (
                        <p className="text-[10px] lg:text-xs text-gray-400 mt-1">
                          Válido até {format(new Date(subscription.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    {user.is_creator ? (
                      <Button
                        onClick={() => router.push('/creator')}
                        className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white text-xs lg:text-sm"
                      >
                        <LayoutDashboard className="h-3 w-3 lg:h-4 lg:w-4" />
                        <span>Painel do Criador</span>
                      </Button>
                    ) : (
                      <Link href="/creator/apply" className="w-full sm:w-auto">
                        <Button
                          variant="primary"
                          className="w-full sm:w-auto flex items-center justify-center space-x-2 text-xs lg:text-sm"
                        >
                          <Sparkles className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span>Torne-se criador</span>
                        </Button>
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full sm:w-auto flex items-center justify-center space-x-2 text-xs lg:text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
                    >
                      <LogOut className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </Card>

              {/* Conteúdo dinâmico baseado na seção ativa */}
              {activeSection === 'account' && (
                <>
                  <div className="mb-6 lg:mb-8">
                    <h1 className="text-2xl lg:text-4xl font-semibold text-gray-900 tracking-tight mb-2">
                      Configurações de conta
                    </h1>
                    <p className="text-sm lg:text-base text-gray-500 font-medium">
                      Atualize informações pessoais e revise seus contratos de serviço.
                    </p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Informações Pessoais */}
        <Card className="mb-6 lg:mb-8 p-4 lg:p-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4 lg:mb-6">Informações pessoais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <Input
                label="Nome completo/Razão Social"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <Input
                label="E-mail"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">O email não pode ser alterado</p>
            </div>

            <div>
              <Input
                label="CPF/CNPJ"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value.replace(/\D/g, '') })}
                placeholder="000.000.000-00"
                maxLength={18}
              />
            </div>

            <div>
              <Input
                label="Telefone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>

            <div>
              <Input
                label="Data de nascimento"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">
                Foto de perfil
              </label>
              <div className="flex items-center space-x-4">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Enviando...' : 'Escolher arquivo'}
                </button>
                <span className="text-sm text-gray-500">
                  {avatarInputRef.current?.files?.[0]?.name || 'Nenhum arquivo escolhido'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Endereço */}
        <Card className="mb-6 lg:mb-8 p-4 lg:p-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4 lg:mb-6">Endereço</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <Input
                label="CEP"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                maxLength={8}
              />
            </div>

            <div>
              <Input
                label="Cidade"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Sua cidade"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">
                Estado
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Selecione o estado</option>
                {estados.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Endereço/Quadra"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, Avenida, Quadra..."
              />
            </div>

            <div>
              <Input
                label="Número/Lote"
                value={formData.address_number}
                onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                placeholder="123"
              />
            </div>

            <div>
              <Input
                label="Bairro"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                placeholder="Nome do bairro"
              />
            </div>
          </div>
        </Card>

        {/* Alterar Senha */}
        <Card className="mb-6 lg:mb-8 p-4 lg:p-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4 lg:mb-6">Alterar senha</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <Input
                label="Nova senha"
                type="password"
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <div>
              <Input
                label="Confirmar nova senha"
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Deixe em branco se não quiser alterar a senha
          </p>
        </Card>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button
            type="submit"
            onClick={handleSave}
            disabled={saving}
            isLoading={saving}
            className="w-full sm:w-auto px-6 lg:px-8 h-11 lg:h-12 text-sm lg:text-base"
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar alterações
          </Button>
        </div>
                  </form>
                </>
              )}

              {activeSection === 'subscriptions' && (
                <div>
                  <div className="mb-6 lg:mb-8">
                    <h1 className="text-2xl lg:text-4xl font-semibold text-gray-900 tracking-tight mb-2">
                      Assinaturas
                    </h1>
                    <p className="text-sm lg:text-base text-gray-500 font-medium">
                      Gerencie sua assinatura e visualize o histórico de pagamentos.
                    </p>
                  </div>

                  {subscriptionDetails ? (
                    <div className="space-y-4 lg:space-y-6">
                      {/* Card Principal da Assinatura */}
                      <Card className="p-4 lg:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 lg:mb-6">
                          <div className="flex-1">
                            <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                              Assinatura {subscriptionDetails.tier.toUpperCase()}
                            </h2>
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                              subscriptionDetails.status === 'active' ? "bg-primary-100 text-primary-700" :
                              subscriptionDetails.status === 'expired' ? "bg-red-100 text-red-700" :
                              subscriptionDetails.status === 'canceled' ? "bg-gray-100 text-gray-700" :
                              "bg-yellow-100 text-yellow-700"
                            )}>
                              {subscriptionDetails.status === 'active' ? 'Ativa' :
                               subscriptionDetails.status === 'expired' ? 'Expirada' :
                               subscriptionDetails.status === 'canceled' ? 'Cancelada' :
                               'Suspensa'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contratado em</p>
                            <p className="text-base font-semibold text-gray-900">
                              {format(new Date(subscriptionDetails.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Vencimento</p>
                            <p className="text-base font-semibold text-gray-900">
                              {format(new Date(subscriptionDetails.current_period_end), "dd 'de' MMMM 'de' yyyy 'às' 23:59", { locale: ptBR })}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Período atual</p>
                            <p className="text-base font-semibold text-gray-900">
                              {format(new Date(subscriptionDetails.current_period_start), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(subscriptionDetails.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Valor</p>
                            <p className="text-base font-semibold text-gray-900">
                              R$ {Number(subscriptionDetails.amount).toFixed(2).replace('.', ',')} / {subscriptionDetails.billing_cycle === 'monthly' ? 'mês' : 'ano'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Método de pagamento</p>
                            <p className="text-base font-semibold text-gray-900">
                              {subscriptionDetails.payment_method === 'PIX' ? 'PIX' :
                               subscriptionDetails.payment_method === 'BOLETO' ? 'Boleto' :
                               subscriptionDetails.payment_method === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                               subscriptionDetails.payment_method || 'Não informado'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Renovação automática</p>
                            <p className="text-base font-semibold text-gray-900">
                              {subscriptionDetails.auto_renew ? 'Ativada' : 'Desativada'}
                            </p>
                          </div>

                          {subscriptionDetails.last_payment_id && (
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Último pagamento</p>
                              <p className="text-base font-semibold text-gray-900 font-mono text-sm">
                                {subscriptionDetails.last_payment_id}
                              </p>
                            </div>
                          )}

                          {subscriptionDetails.canceled_at && (
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cancelado em</p>
                              <p className="text-base font-semibold text-gray-900">
                                {format(new Date(subscriptionDetails.canceled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>

                      {/* Histórico de Transações */}
                      {transactions.length > 0 && (
                        <Card className="p-4 lg:p-8">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 lg:mb-6">
                            <h3 className="text-lg lg:text-xl font-semibold text-gray-900">Histórico de Pagamentos</h3>
                            <button
                              onClick={refreshTransactionsStatus}
                              disabled={refreshingTransactions}
                              className="text-xs lg:text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 self-start sm:self-auto"
                            >
                              {refreshingTransactions ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  <span>Atualizando...</span>
                                </>
                              ) : (
                                <span>Atualizar status</span>
                              )}
                            </button>
                          </div>
                          <div className="space-y-3 lg:space-y-4">
                            {transactions.map((transaction) => (
                              <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 lg:p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 lg:gap-3 mb-1">
                                    <p className="text-xs lg:text-sm font-semibold text-gray-900">
                                      {format(new Date(transaction.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                    <span className={cn(
                                      "px-2 py-1 rounded text-[10px] lg:text-xs font-bold uppercase flex-shrink-0",
                                      transaction.status === 'paid' ? "bg-primary-100 text-primary-700" :
                                      transaction.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                                      transaction.status === 'overdue' ? "bg-orange-100 text-orange-700" :
                                      "bg-red-100 text-red-700"
                                    )}>
                                      {transaction.status === 'paid' ? 'Pago' :
                                       transaction.status === 'pending' ? 'Pendente' :
                                       transaction.status === 'overdue' ? 'Vencido' :
                                       transaction.status === 'canceled' ? 'Cancelado' :
                                       transaction.status}
                                    </span>
                                  </div>
                                  <p className="text-[10px] lg:text-xs text-gray-500 break-words">
                                    {transaction.payment_method?.replace('asaas_', '').toUpperCase()} • 
                                    Plano {transaction.subscription_tier?.toUpperCase()} • 
                                    R$ {Number(transaction.amount_brute).toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                                <div className="text-left sm:text-right flex-shrink-0">
                                  <p className="text-base lg:text-lg font-bold text-gray-900">
                                    R$ {Number(transaction.amount_brute).toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <Card className="p-6 lg:p-8 text-center mb-6 lg:mb-8">
                      <CreditCard className="h-10 w-10 lg:h-12 lg:w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Nenhuma assinatura ativa</h3>
                      <p className="text-sm lg:text-base text-gray-500 mb-4 lg:mb-6">Você ainda não possui uma assinatura premium.</p>
                      <Button onClick={() => router.push('/premium')} className="w-full sm:w-auto">
                        Assinar Premium
                      </Button>
                    </Card>
                  )}

                  {/* Todas as Assinaturas (Incluindo Expiradas e Canceladas) */}
                  {allSubscriptions.length > 0 && (
                    <div className="space-y-4 lg:space-y-6 mt-6 lg:mt-8">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h2 className="text-xl lg:text-2xl font-semibold text-gray-900">Histórico de Assinaturas</h2>
                        <span className="text-xs lg:text-sm text-gray-500">
                          {allSubscriptions.length} {allSubscriptions.length === 1 ? 'assinatura' : 'assinaturas'}
                        </span>
                      </div>

                      <div className="grid gap-3 lg:gap-4">
                        {(showAllSubscriptions ? allSubscriptions : allSubscriptions.slice(0, SUBSCRIPTIONS_LIMIT)).map((sub) => {
                          const isActive = sub.status === 'active'
                          const isExpired = sub.status === 'expired'
                          const isCanceled = sub.status === 'canceled'
                          const isSuspended = sub.status === 'suspended'
                          
                          return (
                            <Card key={sub.id} className={cn(
                              "p-4 lg:p-6 border-2 transition-all",
                              isActive ? "border-primary-200 bg-primary-50/30" :
                              isExpired ? "border-red-200 bg-red-50/30" :
                              isCanceled ? "border-gray-200 bg-gray-50/30" :
                              "border-yellow-200 bg-yellow-50/30"
                            )}>
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 lg:mb-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 lg:gap-3 mb-2">
                                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">
                                      Premium {sub.tier.toUpperCase()}
                                    </h3>
                                    <span className={cn(
                                      "px-2 lg:px-3 py-1 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-wider flex-shrink-0",
                                      isActive ? "bg-primary-100 text-primary-700" :
                                      isExpired ? "bg-red-100 text-red-700" :
                                      isCanceled ? "bg-gray-100 text-gray-700" :
                                      "bg-yellow-100 text-yellow-700"
                                    )}>
                                      {isActive ? 'Ativa' :
                                       isExpired ? 'Expirada' :
                                       isCanceled ? 'Cancelada' :
                                       'Suspensa'}
                                    </span>
                                  </div>
                                  <p className="text-xs lg:text-sm text-gray-500">
                                    Criada em {format(new Date(sub.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                                <div className="text-left sm:text-right flex-shrink-0">
                                  <p className="text-base lg:text-lg font-bold text-gray-900">
                                    R$ {Number(sub.amount).toFixed(2).replace('.', ',')}
                                  </p>
                                  <p className="text-[10px] lg:text-xs text-gray-500">
                                    / {sub.billing_cycle === 'monthly' ? 'mês' : 'ano'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 pt-3 lg:pt-4 border-t border-gray-200">
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Período</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {format(new Date(sub.current_period_start), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pagamento</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {sub.payment_method === 'PIX' ? 'PIX' :
                                     sub.payment_method === 'BOLETO' ? 'Boleto' :
                                     sub.payment_method === 'CREDIT_CARD' ? 'Cartão' :
                                     sub.payment_method || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Renovação</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {sub.auto_renew ? 'Automática' : 'Manual'}
                                  </p>
                                </div>
                                {sub.canceled_at && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cancelada em</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {format(new Date(sub.canceled_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {sub.last_payment_id && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Último Pagamento ID</p>
                                  <p className="text-sm font-mono text-gray-700 break-all">
                                    {sub.last_payment_id}
                                  </p>
                                </div>
                              )}
                            </Card>
                          )
                        })}
                      </div>
                      
                      {allSubscriptions.length > SUBSCRIPTIONS_LIMIT && (
                        <div className="flex justify-center">
                          <button
                            onClick={() => setShowAllSubscriptions(!showAllSubscriptions)}
                            className="flex items-center space-x-2 px-6 py-3 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            {showAllSubscriptions ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                <span>Mostrar menos</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                <span>Ver mais ({allSubscriptions.length - SUBSCRIPTIONS_LIMIT} {allSubscriptions.length - SUBSCRIPTIONS_LIMIT === 1 ? 'assinatura' : 'assinaturas'})</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Histórico Completo de Pagamentos */}
                  {transactions.length > 0 && (
                    <Card className="p-4 lg:p-8 mt-6 lg:mt-8">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 lg:mb-6">
                        <div>
                          <h3 className="text-xl lg:text-2xl font-semibold text-gray-900">Histórico Completo de Pagamentos</h3>
                          <p className="text-xs lg:text-sm text-gray-500 mt-1">
                            {transactions.length} {transactions.length === 1 ? 'pagamento' : 'pagamentos'} encontrados
                          </p>
                        </div>
                        <button
                          onClick={refreshTransactionsStatus}
                          disabled={refreshingTransactions}
                          className="text-xs lg:text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 self-start sm:self-auto"
                        >
                          {refreshingTransactions ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                              <span>Atualizando...</span>
                            </>
                          ) : (
                            <>
                              <span>Atualizar status</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(showAllTransactions ? transactions : transactions.slice(0, TRANSACTIONS_LIMIT)).map((transaction) => (
                          <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 lg:p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 lg:gap-3 mb-2">
                                <p className="text-xs lg:text-sm font-semibold text-gray-900">
                                  {format(new Date(transaction.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                <span className={cn(
                                  "px-2 py-1 rounded text-[10px] lg:text-xs font-bold uppercase flex-shrink-0",
                                  transaction.status === 'paid' ? "bg-primary-100 text-primary-700" :
                                  transaction.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                                  transaction.status === 'overdue' ? "bg-orange-100 text-orange-700" :
                                  "bg-red-100 text-red-700"
                                )}>
                                  {transaction.status === 'paid' ? 'Pago' :
                                   transaction.status === 'pending' ? 'Pendente' :
                                   transaction.status === 'overdue' ? 'Vencido' :
                                   transaction.status === 'canceled' ? 'Cancelado' :
                                   transaction.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-[10px] lg:text-xs text-gray-500">
                                <span>
                                  {transaction.payment_method?.replace('asaas_', '').toUpperCase() || 'N/A'}
                                </span>
                                {transaction.subscription_tier && (
                                  <>
                                    <span>•</span>
                                    <span>Plano {transaction.subscription_tier.toUpperCase()}</span>
                                  </>
                                )}
                                {transaction.amount_fees > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>Taxa: R$ {Number(transaction.amount_fees).toFixed(2).replace('.', ',')}</span>
                                  </>
                                )}
                              </div>
                              {transaction.id && (
                                <p className="text-[10px] lg:text-xs text-gray-400 mt-1 font-mono break-all">
                                  ID: {transaction.id}
                                </p>
                              )}
                            </div>
                            <div className="text-left sm:text-right ml-0 sm:ml-4 flex-shrink-0">
                              <p className="text-base lg:text-lg font-bold text-gray-900">
                                R$ {Number(transaction.amount_brute).toFixed(2).replace('.', ',')}
                              </p>
                              {transaction.amount_liquid && transaction.amount_liquid !== transaction.amount_brute && (
                                <p className="text-[10px] lg:text-xs text-gray-500">
                                  Líquido: R$ {Number(transaction.amount_liquid).toFixed(2).replace('.', ',')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {transactions.length > TRANSACTIONS_LIMIT && (
                        <div className="flex justify-center pt-4 border-t border-gray-200">
                          <button
                            onClick={() => setShowAllTransactions(!showAllTransactions)}
                            className="flex items-center space-x-2 px-6 py-3 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            {showAllTransactions ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                <span>Mostrar menos</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                <span>Ver mais ({transactions.length - TRANSACTIONS_LIMIT} {transactions.length - TRANSACTIONS_LIMIT === 1 ? 'pagamento' : 'pagamentos'})</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Mensagem quando não há histórico */}
                  {transactions.length === 0 && allSubscriptions.length === 0 && !subscriptionDetails && (
                    <Card className="p-6 lg:p-8 text-center">
                      <CreditCard className="h-10 w-10 lg:h-12 lg:w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Nenhum histórico encontrado</h3>
                      <p className="text-sm lg:text-base text-gray-500 mb-4 lg:mb-6">Você ainda não possui assinaturas ou pagamentos registrados.</p>
                      <Button onClick={() => router.push('/premium')} className="w-full sm:w-auto">
                        Assinar Premium
                      </Button>
                    </Card>
                  )}
                </div>
              )}

              {/* Seção de Downloads */}
              {activeSection === 'downloads' && (
                <div>
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 lg:mb-6">
                    <div>
                      <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Histórico de downloads</h2>
                      <p className="text-sm lg:text-base text-gray-600">
                        Veja o histórico de downloads e acesse seus recursos gráficos anteriores.
                      </p>
                    </div>
                    <Button
                      onClick={handleRefreshDownloads}
                      disabled={refreshingDownloads}
                      variant="secondary"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs lg:text-sm"
                    >
                      <RefreshCw className={cn("h-3 w-3 lg:h-4 lg:w-4", refreshingDownloads && "animate-spin")} />
                      Atualizar
                    </Button>
                  </div>

                  {/* Barra de Estatísticas */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3 lg:p-4 mb-4 lg:mb-6">
                    <div className="flex flex-wrap items-center gap-3 lg:gap-6 text-xs lg:text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Info className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-gray-600">Downloads hoje</span>
                        <span className="font-semibold text-gray-900">
                          {downloadStatus?.current || 0} / {downloadStatus?.limit || getDownloadLimitByPlan(user?.subscription_tier || 'free')}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-gray-300"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Restantes</span>
                        <span className="font-semibold text-gray-900">
                          {downloadStatus?.remaining || Math.max(0, (downloadStatus?.limit || getDownloadLimitByPlan(user?.subscription_tier || 'free')) - (downloadStatus?.current || 0))}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-gray-300"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Plano</span>
                        <span className="font-semibold text-blue-600">
                          {user?.subscription_tier ? formatPlanName(user.subscription_tier) : 'Grátis'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Banner de Informações Importantes */}
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 lg:p-4 mb-4 lg:mb-6">
                    <div className="flex gap-2 lg:gap-3">
                      <Info className="h-4 w-4 lg:h-5 lg:w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm lg:text-base font-semibold text-primary-900 mb-1">Informação importante!</h3>
                        <p className="text-xs lg:text-sm text-primary-800">
                          Se você baixar o mesmo arquivo várias vezes no mesmo dia, ele contará apenas como um download. 
                          No entanto, se você atingir o limite de downloads, não poderá baixar mais nenhum arquivo, mesmo que tenha baixado o mesmo arquivo naquele dia. 
                          Se você baixar um arquivo que já foi baixado no dia anterior, será considerado um novo download.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Downloads */}
                  {loadingDownloads ? (
                    <div className="text-center py-12 lg:py-20">
                      <div className="animate-spin rounded-full h-10 w-10 lg:h-12 lg:w-12 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-4 text-sm lg:text-base text-gray-600">Carregando downloads...</p>
                    </div>
                  ) : downloads.filter(d => d.resource).length > 0 ? (
                    <Card className="overflow-hidden">
                      <div className="overflow-x-auto -mx-4 lg:mx-0">
                        <div className="min-w-full inline-block align-middle">
                          {/* Mobile View - Cards */}
                          <div className="lg:hidden space-y-3 p-4">
                            {downloads.filter(d => d.resource).map((download) => {
                              if (!download.resource) return null
                              const resource = download.resource
                              const downloadDate = new Date(download.downloaded_at)
                              const licenseId = generateLicenseId(download.id, download.downloaded_at)
                              const typeInfo = getResourceTypeInfo(resource.resource_type)
                              const TypeIcon = typeInfo.icon

                              return (
                                <div key={download.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                  <div className="flex gap-3 mb-3">
                                    <Link 
                                      href={`/resources/${resource.id}`}
                                      className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100"
                                    >
                                      {resource.thumbnail_url ? (
                                        <img
                                          src={resource.thumbnail_url.startsWith('http') 
                                            ? resource.thumbnail_url 
                                            : `/api/image/${resource.thumbnail_url}?q=75`}
                                          alt={resource.title}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <TypeIcon className="h-5 w-5 text-gray-400" />
                                        </div>
                                      )}
                                    </Link>
                                    <div className="min-w-0 flex-1">
                                      <Link 
                                        href={`/resources/${resource.id}`}
                                        className="block"
                                      >
                                        <p className="text-xs font-medium text-gray-900 truncate hover:text-primary-600 transition-colors">
                                          {resource.title}
                                        </p>
                                      </Link>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                                          {typeInfo.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">Licença: </span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(licenseId)
                                          toast.success('ID da licença copiado!')
                                        }}
                                        className="text-blue-600 hover:text-blue-700 font-medium"
                                      >
                                        {licenseId}
                                      </button>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Data: </span>
                                      <span className="text-gray-900">
                                        {format(downloadDate, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                                      <span className="text-gray-900">Concluído</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Desktop View - Table */}
                          <table className="hidden lg:table w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Arquivo
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Licença
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Data
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {downloads.filter(d => d.resource).map((download) => {
                              if (!download.resource) return null
                              const resource = download.resource
                              const downloadDate = new Date(download.downloaded_at)
                              const licenseId = generateLicenseId(download.id, download.downloaded_at)
                              const typeInfo = getResourceTypeInfo(resource.resource_type)
                              const TypeIcon = typeInfo.icon

                              return (
                                <tr key={download.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                      <Link 
                                        href={`/resources/${resource.id}`}
                                        className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 group"
                                      >
                                        {resource.thumbnail_url ? (
                                          <img
                                            src={resource.thumbnail_url.startsWith('http') 
                                              ? resource.thumbnail_url 
                                              : `/api/image/${resource.thumbnail_url}?q=75`}
                                            alt={resource.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <TypeIcon className="h-6 w-6 text-gray-400" />
                                          </div>
                                        )}
                                      </Link>
                                      <div className="min-w-0 flex-1">
                                        <Link 
                                          href={`/resources/${resource.id}`}
                                          className="block"
                                        >
                                          <p className="text-sm font-medium text-gray-900 truncate hover:text-primary-600 transition-colors">
                                            {resource.title}
                                          </p>
                                        </Link>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                            {typeInfo.label}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(licenseId)
                                        toast.success('ID da licença copiado!')
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                    >
                                      {licenseId}
                                    </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                      {format(downloadDate, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                                      <span className="text-sm text-gray-900">Concluído</span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <Card className="p-8 lg:p-12 text-center">
                      <Download className="h-12 w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-base lg:text-lg text-gray-600 mb-2">Você ainda não fez nenhum download</p>
                      <Link
                        href="/explore"
                        className="text-sm lg:text-base text-primary-600 hover:text-primary-700 font-medium inline-block mt-2"
                      >
                        Explorar recursos
                      </Link>
                    </Card>
                  )}
                </div>
              )}

              {/* Placeholder para outras seções */}
              {activeSection !== 'account' && activeSection !== 'subscriptions' && activeSection !== 'downloads' && (
                <div className="text-center py-20">
                  <p className="text-gray-500 font-semibold">Seção em desenvolvimento</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload, User, Save, LogOut, CreditCard, Download, Heart, Users, Gift, MessageCircle, Mail } from 'lucide-react'
import type { Profile } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'

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
  const [transactions, setTransactions] = useState<any[]>([])
  const [refreshingTransactions, setRefreshingTransactions] = useState(false)

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
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        console.error('Erro de autenticação:', authError)
        router.push('/login')
        setLoading(false)
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
        // Buscar transações relacionadas
        const { data: subscriptionTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
        
        setSubscriptionDetails(activeSubscription)
        setTransactions(subscriptionTransactions || [])
        
        // Verificar status dos pagamentos no Asaas
        await refreshTransactionsStatus()
      } else {
        setSubscriptionDetails(null)
        setTransactions([])
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
    <div className="min-h-screen bg-[#F8F9FA] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex overflow-hidden">
          {/* Sidebar dentro do container */}
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-4">
            Acesso rápido
          </h3>
          {menuItems.map((item) => {
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
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
          <div className="flex-1 overflow-y-auto">
            <div className="p-10">
              {/* Header do Usuário - Sempre visível */}
              <Card className="mb-8 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
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
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">{user.full_name || 'Usuário'}</h3>
                        {user.is_premium && subscription && (
                          <span className={cn(
                            "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                            subscription.tier === 'lite' ? "bg-blue-100 text-blue-700" :
                            subscription.tier === 'pro' ? "bg-primary-100 text-primary-700" :
                            "bg-purple-100 text-purple-700"
                          )}>
                            Premium {subscription.tier.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      {subscription && (
                        <p className="text-xs text-gray-400 mt-1">
                          Válido até {format(new Date(subscription.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </Card>

              {/* Conteúdo dinâmico baseado na seção ativa */}
              {activeSection === 'account' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">
                      Configurações de conta
                    </h1>
                    <p className="text-gray-500 font-medium">
                      Atualize informações pessoais e revise seus contratos de serviço.
                    </p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Informações Pessoais */}
        <Card className="mb-8 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Informações pessoais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <Card className="mb-8 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Endereço</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <Card className="mb-8 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Alterar senha</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            className="px-8 h-12"
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
                  <div className="mb-8">
                    <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">
                      Assinaturas
                    </h1>
                    <p className="text-gray-500 font-medium">
                      Gerencie sua assinatura e visualize o histórico de pagamentos.
                    </p>
                  </div>

                  {subscriptionDetails ? (
                    <div className="space-y-6">
                      {/* Card Principal da Assinatura */}
                      <Card className="p-8">
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                              Assinatura {subscriptionDetails.tier.toUpperCase()}
                            </h2>
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                              subscriptionDetails.status === 'active' ? "bg-green-100 text-green-700" :
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <Card className="p-8">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-900">Histórico de Pagamentos</h3>
                            <button
                              onClick={refreshTransactionsStatus}
                              disabled={refreshingTransactions}
                              className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
                          <div className="space-y-4">
                            {transactions.map((transaction) => (
                              <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                      {format(new Date(transaction.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                    <span className={cn(
                                      "px-2 py-1 rounded text-xs font-bold uppercase",
                                      transaction.status === 'paid' ? "bg-green-100 text-green-700" :
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
                                  <p className="text-xs text-gray-500">
                                    {transaction.payment_method?.replace('asaas_', '').toUpperCase()} • 
                                    Plano {transaction.subscription_tier?.toUpperCase()} • 
                                    R$ {Number(transaction.amount_brute).toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-gray-900">
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
                    <Card className="p-8 text-center">
                      <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma assinatura ativa</h3>
                      <p className="text-gray-500 mb-6">Você ainda não possui uma assinatura premium.</p>
                      <Button onClick={() => router.push('/premium')}>
                        Assinar Premium
                      </Button>
                    </Card>
                  )}
                </div>
              )}

              {/* Placeholder para outras seções */}
              {activeSection !== 'account' && activeSection !== 'subscriptions' && (
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

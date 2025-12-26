'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload, User, Save, LogOut } from 'lucide-react'
import type { Profile } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import DownloadStats from '@/components/user/DownloadStats'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { checkAndUpdateSubscriptionStatusClient } from '@/lib/utils/subscription-check'

export default function AccountPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [user, setUser] = useState<Profile | null>(null)
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

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }

      // Verificar e atualizar status da assinatura antes de carregar perfil
      await checkAndUpdateSubscriptionStatusClient(authUser.id)

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error) throw error

      if (profile) {
        setUser(profile)
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
      toast.error('Erro ao carregar perfil')
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

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">
          Configurações de conta
        </h1>
        <p className="text-gray-500 font-medium">
          Atualize informações pessoais e revise seus contratos de serviço.
        </p>
      </div>

      {/* Informações do Usuário no Topo */}
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
              <h3 className="text-lg font-semibold text-gray-900">{user.full_name || 'Usuário'}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
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

      {/* Estatísticas de Downloads */}
      <div className="mb-8">
        <DownloadStats userId={user.id} />
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
    </div>
  )
}


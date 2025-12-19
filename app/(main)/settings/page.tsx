'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload, User, Image as ImageIcon, Save, X } from 'lucide-react'
import type { Profile } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'idle' | 'avatar' | 'cover'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
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

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

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
              avatar_url: null,
              cover_image: null,
            })
            .select()
            .single()
          
          if (createError) {
            throw createError
          }
          setUser(newProfile)
          setFormData({
            full_name: newProfile.full_name || '',
            email: newProfile.email || '',
          })
          return
        }
        throw error
      }

      if (!profile) {
        throw new Error('Perfil não encontrado')
      }

      setUser(profile)
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
      })
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error)
      toast.error('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(file: File, type: 'avatar' | 'cover') {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas')
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB')
      return
    }

    setUploading(type)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          toast.success(`${type === 'avatar' ? 'Avatar' : 'Capa'} atualizado com sucesso!`)
          
          // Atualizar estado local
          if (user) {
            const updatedUser = {
              ...user,
              [type === 'avatar' ? 'avatar_url' : 'cover_image']: response.url
            }
            setUser(updatedUser)
          }
          
          // Recarregar dados do servidor
          await loadUser()
        } else {
          const error = JSON.parse(xhr.responseText)
          toast.error(error.error || 'Erro ao fazer upload')
        }
        setUploading('idle')
        setUploadProgress(0)
      })

      xhr.addEventListener('error', () => {
        toast.error('Erro ao fazer upload')
        setUploading('idle')
        setUploadProgress(0)
      })

      xhr.open('POST', '/api/profile/upload')
      xhr.send(formData)
    } catch (error: any) {
      console.error('Erro no upload:', error)
      toast.error('Erro ao fazer upload')
      setUploading('idle')
      setUploadProgress(0)
    }
  }

  async function handleSave() {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Perfil atualizado com sucesso!')
      await loadUser()
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-600"></div>
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Configurações do Perfil</h1>

      {/* Cover Image */}
      <Card className="mb-8 overflow-hidden p-0">
        <div className="relative h-64 bg-gradient-to-br from-secondary-500 via-primary-500 to-secondary-600">
          {user.cover_image ? (
            <Image
              src={getS3Url(user.cover_image)}
              alt="Capa"
              fill
              className="object-cover"
            />
          ) : null}
          
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, 'cover')
              }}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === 'cover'}
              className="px-6 py-3 bg-white/90 hover:bg-white text-gray-900 rounded-xl font-semibold transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {uploading === 'cover' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  <span>Enviando... {Math.round(uploadProgress)}%</span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-5 w-5" />
                  <span>{user.cover_image ? 'Alterar Capa' : 'Adicionar Capa'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* Profile Info Card */}
      <Card className="mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
          {/* Avatar */}
          <div className="relative">
            <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100">
              {user.avatar_url ? (
                <Image
                  src={getS3Url(user.avatar_url)}
                  alt={user.full_name || 'Avatar'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-secondary-500 to-primary-500">
                  <User className="h-16 w-16 text-white" />
                </div>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, 'avatar')
              }}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploading === 'avatar'}
              className="absolute -bottom-2 -right-2 p-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg transition-all disabled:opacity-50"
            >
              {uploading === 'avatar' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </button>
            {uploading === 'avatar' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <span className="text-white text-xs font-semibold">{Math.round(uploadProgress)}%</span>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 space-y-4">
            <div>
              <Input
                label="Nome Completo"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <Input
                label="Email"
                value={formData.email}
                disabled
                className="bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">O email não pode ser alterado</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          isLoading={saving}
          className="px-8"
        >
          <Save className="mr-2 h-4 w-4" />
          Salvar Alterações
        </Button>
      </div>
    </div>
  )
}


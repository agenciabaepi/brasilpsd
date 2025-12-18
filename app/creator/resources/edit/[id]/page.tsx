'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, Image as ImageIcon, Info, ChevronLeft, Save, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ResourceType, Resource, Profile } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'

export default function EditResourcePage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'image' as ResourceType,
    category_id: '',
    keywords: '',
    is_premium: false,
    is_official: false,
    price: '',
  })

  const supabase = createSupabaseClient()

  useEffect(() => {
    loadInitialData()
  }, [params.id])

  async function loadInitialData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Load Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setUserProfile(profile)

      // Load Categories
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .order('name')
      setCategories(cats || [])

      // Load Resource
      const { data: resource, error } = await supabase
        .from('resources')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      // Check permissions
      if (!profile?.is_admin && resource.creator_id !== user.id) {
        toast.error('Você não tem permissão para editar este arquivo')
        router.push('/creator/resources')
        return
      }

      setFormData({
        title: resource.title || '',
        description: resource.description || '',
        resource_type: (resource.resource_type as ResourceType) || 'image',
        category_id: resource.category_id || '',
        keywords: resource.keywords?.join(', ') || '',
        is_premium: resource.is_premium || false,
        is_official: resource.is_official || false,
        price: resource.price?.toString() || '',
      })

      if (resource.thumbnail_url) {
        setPreview(getS3Url(resource.thumbnail_url))
      }
    } catch (error: any) {
      toast.error('Erro ao carregar o arquivo')
      router.push(userProfile?.is_admin ? '/admin/resources' : '/creator/resources')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)

    try {
      // 1. Upload thumbnail if changed
      let thumbnailUrl = null
      
      if (thumbnail) {
        const thumbFormData = new FormData()
        thumbFormData.append('file', thumbnail)
        thumbFormData.append('type', 'thumbnail')

        const thumbResponse = await fetch('/api/upload', {
          method: 'POST',
          body: thumbFormData,
        })

        if (thumbResponse.ok) {
          const thumbData = await thumbResponse.json()
          thumbnailUrl = thumbData.url
        }
      }

      // 2. Update database
      const updateData: any = {
        title: formData.title,
        description: formData.description,
        resource_type: formData.resource_type,
        category_id: formData.category_id || null,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
        is_premium: formData.is_premium,
        is_official: formData.is_official,
        price: formData.price ? parseFloat(formData.price) : null,
      }

      if (thumbnailUrl) {
        updateData.thumbnail_url = thumbnailUrl
      }

      // If official or edited by admin, keep approved
      if (formData.is_official || userProfile?.is_admin) {
        updateData.status = 'approved'
      }

      const { error } = await supabase
        .from('resources')
        .update(updateData)
        .eq('id', params.id)

      if (error) throw error

      toast.success('Arquivo atualizado com sucesso!')
      router.push(userProfile?.is_admin ? '/admin/resources' : '/creator/resources')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar arquivo')
    } finally {
      setIsSaving(false)
    }
  }

  function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setThumbnail(selectedFile)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex flex-col space-y-4 mb-10">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-400 hover:text-gray-600 transition-colors text-xs font-semibold uppercase tracking-widest"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </button>
        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Editar Arquivo</h1>
        <p className="text-gray-500 font-medium">Atualize as informações do recurso.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none p-8">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tighter mb-8 flex items-center">
              <span className="h-6 w-1 bg-primary-500 mr-3 rounded-full" />
              Informações Gerais
            </h2>
            
            <div className="space-y-6">
              <Input
                label="Título do Arquivo"
                placeholder="Ex: Mockup de Camiseta Minimalista"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                  Descrição do Recurso
                </label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all"
                  placeholder="Dê detalhes sobre o que está incluído no arquivo..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                    Tipo de Arquivo
                  </label>
                  <select
                    className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all appearance-none"
                    value={formData.resource_type}
                    onChange={(e) => setFormData({ ...formData, resource_type: e.target.value as ResourceType })}
                    required
                  >
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                    <option value="font">Fonte</option>
                    <option value="psd">PSD</option>
                    <option value="ai">AI</option>
                    <option value="audio">Áudio</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-2">
                    Categoria
                  </label>
                  <select
                    className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all appearance-none"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    <option value="">Selecionar Categoria</option>
                    {categories
                      .filter(cat => !cat.parent_id)
                      .map((parent) => (
                        <optgroup key={parent.id} label={parent.name}>
                          <option value={parent.id}>{parent.name} (Tudo)</option>
                          {categories
                            .filter(sub => sub.parent_id === parent.id)
                            .map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                &nbsp;&nbsp;{sub.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                  </select>
                </div>
              </div>

              <Input
                label="Tags (Vírgulas)"
                placeholder="moderno, psd, tech"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              />

              <div className="pt-4 space-y-4">
                <div className="flex items-center space-x-8 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <label className="flex items-center cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.is_premium}
                        onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                      />
                      <div className={`block w-14 h-8 rounded-full transition-all ${formData.is_premium ? 'bg-primary-500' : 'bg-gray-300'}`} />
                      <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all transform ${formData.is_premium ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <span className="ml-4 text-xs font-semibold text-gray-700 tracking-tighter uppercase">Este recurso é Premium</span>
                  </label>

                  {formData.is_premium && (
                    <div className="flex-1">
                      <Input
                        type="number"
                        label="Preço de Venda (R$)"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {userProfile?.is_admin && (
                  <div className="flex items-center space-x-8 p-6 bg-gray-900 rounded-3xl border border-gray-800">
                    <label className="flex items-center cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={formData.is_official}
                          onChange={(e) => setFormData({ ...formData, is_official: e.target.checked })}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-all ${formData.is_official ? 'bg-primary-500' : 'bg-gray-700'}`} />
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all transform ${formData.is_official ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                      <div className="ml-4 flex flex-col">
                        <span className="text-xs font-bold text-white tracking-tighter uppercase flex items-center gap-2">
                          <ShieldCheck className="h-3 w-3 text-primary-500" />
                          Arquivo Oficial BrasilPSD
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">O sistema aparecerá como autor oficial</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-none p-8">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tighter mb-8 flex items-center">
              <span className="h-6 w-1 bg-primary-500 mr-3 rounded-full" />
              Capa / Thumbnail
            </h2>
            
            <div className="grid grid-cols-1 gap-8">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-4 uppercase">
                  Alterar Imagem de Capa (JPG, PNG)
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                  />
                  <div className="h-40 rounded-3xl border-2 border-dashed border-gray-200 group-hover:border-primary-500 group-hover:bg-primary-50/30 transition-all flex flex-col items-center justify-center p-6 text-center">
                    <ImageIcon className="h-8 w-8 text-gray-300 group-hover:text-primary-500 mb-2 transition-colors" />
                    <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase group-hover:text-primary-600">
                      {thumbnail ? thumbnail.name : 'Clique para alterar a capa'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {preview && (
              <div className="mt-8 rounded-3xl overflow-hidden border border-gray-100 max-w-sm mx-auto">
                <p className="p-4 bg-gray-50 text-[10px] font-semibold text-gray-400 tracking-widest border-b border-gray-100 uppercase">Pré-visualização</p>
                <img src={preview} alt="Preview" className="w-full h-auto" />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary-500 border-none p-8 text-white rounded-[2rem]">
            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <Info className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-xl mb-4 uppercase">Status do Arquivo</h3>
            <p className="text-sm font-medium text-primary-50/80 leading-relaxed mb-6">
              {userProfile?.is_admin 
                ? 'Como administrador, suas alterações são aplicadas instantaneamente e o arquivo permanece aprovado.'
                : 'Após salvar as alterações, seu arquivo pode passar por uma nova revisão se houver mudanças significativas no título ou categoria.'
              }
            </p>
            <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase">ID do Recurso</span>
              <span className="text-[10px] font-bold opacity-60">#{params.id.toString().substring(0, 8)}</span>
            </div>
          </Card>

          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-semibold text-xs tracking-widest transition-all disabled:opacity-50 uppercase flex items-center justify-center space-x-2 shadow-lg shadow-gray-200"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push(userProfile?.is_admin ? '/admin/resources' : '/creator/resources')}
              className="w-full py-4 text-gray-400 hover:text-gray-600 font-semibold text-[10px] tracking-[0.2em] transition-all uppercase"
            >
              Descartar Mudanças
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

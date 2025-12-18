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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing'>('idle')
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
  })

  const supabase = createSupabaseClient()

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setUserProfile(profile)

        const { data: cats } = await supabase
          .from('categories')
          .select('id, name, parent_id')
          .order('name')
        setCategories(cats || [])

        const { data: resource, error } = await supabase
          .from('resources')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error

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
        })

        if (resource.thumbnail_url) {
          setPreview(getS3Url(resource.thumbnail_url))
        }
      } catch (error: any) {
        toast.error('Erro ao carregar o arquivo')
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router])

  function uploadWithProgress(file: File, type: 'resource' | 'thumbnail'): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(percent)
        }
      })

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error('Falha no upload'))
          }
        }
      }

      xhr.onerror = () => reject(new Error('Erro de conexão'))
      xhr.open('POST', '/api/upload')
      xhr.send(fd)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setUploadProgress(0)
    setUploadPhase('uploading')

    try {
      let thumbnailUrl = null
      if (thumbnail) {
        const thumbData = await uploadWithProgress(thumbnail, 'thumbnail')
        thumbnailUrl = thumbData.url
        setUploadPhase('processing')
      }

      const updateData: any = {
        title: formData.title,
        description: formData.description,
        resource_type: formData.resource_type,
        category_id: formData.category_id || null,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
        is_premium: formData.is_premium,
        is_official: formData.is_official,
      }

      if (thumbnailUrl) {
        updateData.thumbnail_url = thumbnailUrl
      }

      if (formData.is_official || userProfile?.is_admin) {
        updateData.status = 'approved'
      }

      const { error } = await supabase
        .from('resources')
        .update(updateData)
        .eq('id', params.id)

      if (error) throw error

      toast.success('Arquivo atualizado!')
      router.push(userProfile?.is_admin ? '/admin/resources' : '/creator/resources')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar')
    } finally {
      setIsSaving(false)
      setUploadPhase('idle')
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
    <div className="max-w-5xl mx-auto pb-20 px-4 md:px-0">
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
                placeholder="Ex: Mockup"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                  Descrição
                </label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/20 transition-all"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <select
                  className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/5 transition-all appearance-none"
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

                <select
                  className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/5 transition-all appearance-none"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  <option value="">Selecionar Categoria</option>
                  {categories.filter(c => !c.parent_id).map(p => (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.id}>{p.name} (Geral)</option>
                      {categories.filter(s => s.parent_id === p.id).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-center space-x-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
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
                    <div className="ml-4 flex flex-col">
                      <span className="text-xs font-semibold text-gray-700 uppercase">Premium</span>
                      <span className="text-[10px] text-gray-400">Exclusivo para assinantes</span>
                    </div>
                  </label>
                </div>

                {userProfile?.is_admin && (
                  <div className="flex items-center space-x-8 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-xl">
                    <label className="flex items-center cursor-pointer">
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
                        <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
                          <ShieldCheck className="h-3 w-3 text-primary-500" />
                          Oficial BrasilPSD
                        </span>
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
            <div className="relative group mb-8">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setThumbnail(f);
                    const r = new FileReader();
                    r.onloadend = () => setPreview(r.result as string);
                    r.readAsDataURL(f);
                  }
                }}
              />
              <div className="h-40 rounded-3xl border-2 border-dashed border-gray-200 group-hover:border-primary-500 flex flex-col items-center justify-center p-6 text-center">
                <ImageIcon className="h-8 w-8 text-gray-300 group-hover:text-primary-500 mb-2" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase">
                  {thumbnail ? thumbnail.name : 'Alterar imagem de capa'}
                </p>
              </div>
            </div>
            {preview && (
              <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm max-w-sm mx-auto">
                <img src={preview} alt="Preview" className="w-full h-auto" />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary-500 border-none p-8 text-white rounded-[2rem] shadow-xl shadow-primary-500/20">
            <h3 className="font-semibold text-xl mb-4 uppercase tracking-tight">Status</h3>
            <p className="text-sm font-medium text-primary-50/90 leading-relaxed">
              {userProfile?.is_admin ? 'Como admin, suas edições são publicadas na hora.' : 'Edições podem passar por nova revisão.'}
            </p>
          </Card>

          <div className="flex flex-col space-y-3">
            {isSaving && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {uploadPhase === 'uploading' ? 'Enviando capa...' : 'Processando...'}
                  </span>
                  <span className="text-[10px] font-black text-primary-500">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-xs tracking-widest uppercase shadow-xl"
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isSaving}
              className="w-full py-4 text-gray-400 font-semibold text-[10px] uppercase"
            >
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

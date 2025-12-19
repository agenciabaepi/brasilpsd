'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Image as ImageIcon, Info, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ResourceType, Profile } from '@/types/database'
import { getSystemProfileIdSync } from '@/lib/utils/system'

export default function UploadResourcePage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'image' as ResourceType,
    category_id: '',
    keywords: '',
    is_premium: false,
    is_official: false,
  })

  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing'>('idle')
  const [uploadStats, setUploadStats] = useState({
    bytesUploaded: 0,
    totalBytes: 0,
    speed: 0, // bytes por segundo
    elapsedTime: 0, // segundos
    remainingTime: 0, // segundos
    startTime: 0,
  })
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          setUserProfile(data)
        }

        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('id, name, parent_id')
          .order('name')
        
        if (catsError) {
          console.error('Erro Supabase Categorias:', catsError)
          toast.error('Erro ao carregar categorias do banco')
        }
        
        console.log('Categorias carregadas:', cats?.length || 0)
        setCategories(cats || [])
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error)
      }
    }
    
    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  function formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 MB/s'
    const mbps = bytesPerSecond / (1024 * 1024)
    if (mbps >= 1) {
      return `${mbps.toFixed(2)} MB/s`
    }
    const kbps = bytesPerSecond / 1024
    return `${kbps.toFixed(2)} KB/s`
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  function uploadWithProgress(file: File, type: 'resource' | 'thumbnail'): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)

      const startTime = Date.now()
      let lastLoaded = 0
      let lastTime = startTime
      let speed = 0

      // Inicializar estatísticas
      setUploadStats({
        bytesUploaded: 0,
        totalBytes: file.size,
        speed: 0,
        elapsedTime: 0,
        remainingTime: 0,
        startTime: startTime,
      })

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const currentTime = Date.now()
          const timeDelta = (currentTime - lastTime) / 1000 // segundos
          const bytesDelta = e.loaded - lastLoaded

          // Calcular velocidade (média móvel simples)
          if (timeDelta > 0) {
            const instantSpeed = bytesDelta / timeDelta
            // Suavizar a velocidade com média móvel
            speed = speed === 0 ? instantSpeed : (speed * 0.7 + instantSpeed * 0.3)
          }

          const elapsedTime = (currentTime - startTime) / 1000
          const remainingBytes = e.total - e.loaded
          const remainingTime = speed > 0 ? remainingBytes / speed : 0

          const percent = Math.round((e.loaded / e.total) * 100)
          
          setUploadProgress(percent)
          setUploadStats({
            bytesUploaded: e.loaded,
            totalBytes: e.total,
            speed: speed,
            elapsedTime: elapsedTime,
            remainingTime: remainingTime,
            startTime: startTime,
          })

          lastLoaded = e.loaded
          lastTime = currentTime

          if (percent === 100) {
            setUploadPhase('processing')
          }
        }
      })

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText))
            } catch (err) {
              reject(new Error('Resposta inválida do servidor'))
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.error || 'Erro no upload'))
            } catch (err) {
              reject(new Error(`Erro ${xhr.status} no servidor`))
            }
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

    if (!file) {
      toast.error('Selecione um arquivo principal')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadPhase('uploading')
    setUploadStats({
      bytesUploaded: 0,
      totalBytes: file.size,
      speed: 0,
      elapsedTime: 0,
      remainingTime: 0,
      startTime: Date.now(),
    })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // 1. Upload do Arquivo Principal
      const fileData = await uploadWithProgress(file, 'resource')
      const fileUrl = fileData.url
      const detectedAi = fileData.isAiGenerated

      // 2. Upload da Capa (se houver)
      let thumbnailUrl = null
      let thumbAiDetected = false
      if (thumbnail) {
        setUploadProgress(0)
        setUploadPhase('uploading')
        setUploadStats({
          bytesUploaded: 0,
          totalBytes: thumbnail.size,
          speed: 0,
          elapsedTime: 0,
          remainingTime: 0,
          startTime: Date.now(),
        })
        const thumbData = await uploadWithProgress(thumbnail, 'thumbnail')
        thumbnailUrl = thumbData.url
        thumbAiDetected = thumbData.isAiGenerated
      }

      setUploadPhase('processing')
      setUploadProgress(100)

      // 3. Salvar no Banco
      // Se for oficial, usar o perfil do sistema como criador
      const creatorId = formData.is_official ? getSystemProfileIdSync() : user.id
      
      const { error } = await supabase
        .from('resources')
        .insert({
          title: formData.title,
          description: formData.description,
          resource_type: formData.resource_type,
          category_id: formData.category_id || null,
          creator_id: creatorId,
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          file_size: file.size,
          file_format: file.name.split('.').pop() || '',
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          is_premium: formData.is_premium,
          is_official: formData.is_official,
          is_ai_generated: detectedAi || thumbAiDetected,
          status: userProfile?.is_admin ? 'approved' : 'pending',
        })

      if (error) throw error

      toast.success('Arquivo enviado com sucesso!')
      router.push('/creator')
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Erro ao enviar recurso')
      setUploadPhase('idle')
      setIsUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => setPreview(reader.result as string)
        reader.readAsDataURL(selectedFile)
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-0">
      <div className="flex flex-col space-y-2 mb-10">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Novo Upload</h1>
        <p className="text-gray-400 font-medium text-sm tracking-wider">Envie seus arquivos para a comunidade BrasilPSD.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none p-8">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tighter mb-8 flex items-center">
              <span className="h-6 w-1 bg-primary-500 mr-3 rounded-full" />
              Informações Técnicas
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
                  className="flex min-h-[120px] w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/20 transition-all"
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
                    className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/20 transition-all appearance-none"
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
                    className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/20 transition-all appearance-none"
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
                      <span className="text-xs font-semibold text-gray-700 tracking-tighter uppercase">Este recurso é Premium</span>
                      <span className="text-[10px] text-gray-400 font-medium tracking-tight">Disponível apenas para assinantes do site</span>
                    </div>
                  </label>
                </div>

                {userProfile?.is_admin && (
                  <div className="flex items-center space-x-8 p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-xl">
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
              Arquivos de Mídia
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-4 uppercase">
                  Arquivo Fonte (ZIP, PSD, AI...)
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileChange}
                    required
                  />
                  <div className="h-40 rounded-3xl border-2 border-dashed border-gray-200 group-hover:border-primary-500 group-hover:bg-primary-50/30 transition-all flex flex-col items-center justify-center p-6 text-center">
                    <UploadIcon className="h-8 w-8 text-gray-300 group-hover:text-primary-500 mb-2 transition-colors" />
                    <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase group-hover:text-primary-600 truncate max-w-full px-4">
                      {file ? file.name : 'Selecionar Arquivo'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-4 uppercase">
                  Capa / Thumbnail (JPG, PNG)
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept="image/*"
                    onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                  />
                  <div className="h-40 rounded-3xl border-2 border-dashed border-gray-200 group-hover:border-primary-500 group-hover:bg-primary-50/30 transition-all flex flex-col items-center justify-center p-6 text-center">
                    <ImageIcon className="h-8 w-8 text-gray-300 group-hover:text-primary-500 mb-2 transition-colors" />
                    <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase group-hover:text-primary-600 truncate max-w-full px-4">
                      {thumbnail ? thumbnail.name : 'Selecionar Capa'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {preview && (
              <div className="mt-8 rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                <p className="p-4 bg-gray-50 text-[10px] font-semibold text-gray-400 tracking-widest border-b border-gray-100 uppercase">Pré-visualização</p>
                <img src={preview} alt="Preview" className="w-full h-auto max-h-[400px] object-contain mx-auto" />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary-500 border-none p-8 text-white rounded-[2rem] shadow-xl shadow-primary-500/20">
            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <Info className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-xl mb-4 uppercase tracking-tight">Regras de Ouro</h3>
            <ul className="space-y-4 text-sm font-medium text-primary-50/90 leading-relaxed">
              <li className="flex items-start">
                <span className="mr-3 mt-1 h-1.5 w-1.5 bg-white rounded-full flex-shrink-0" />
                <span>Arquivos em PSD devem conter camadas organizadas.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 mt-1 h-1.5 w-1.5 bg-white rounded-full flex-shrink-0" />
                <span>Imagens devem ter alta resolução para boa qualidade.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 mt-1 h-1.5 w-1.5 bg-white rounded-full flex-shrink-0" />
                <span>Não utilize marcas registradas sem autorização.</span>
              </li>
            </ul>
          </Card>

          <div className="flex flex-col space-y-3">
            {isUploading && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {uploadPhase === 'uploading' ? 'Enviando arquivos...' : 'Processando mídia...'}
                  </span>
                  <span className="text-[10px] font-black text-primary-500">{uploadProgress}%</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                {uploadPhase === 'uploading' && uploadStats.totalBytes > 0 && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Enviado</span>
                        <span className="text-xs font-bold text-gray-900">
                          {formatBytes(uploadStats.bytesUploaded)} / {formatBytes(uploadStats.totalBytes)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Velocidade</span>
                        <span className="text-xs font-bold text-primary-600">{formatSpeed(uploadStats.speed)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Tempo decorrido</span>
                        <span className="text-xs font-bold text-gray-700">{formatTime(uploadStats.elapsedTime)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Tempo restante</span>
                        <span className="text-xs font-bold text-gray-700">
                          {uploadStats.speed > 0 && uploadStats.remainingTime > 0 
                            ? formatTime(uploadStats.remainingTime) 
                            : 'Calculando...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 font-medium text-center italic pt-2">
                  {uploadPhase === 'processing' ? 'Isso pode levar alguns segundos para arquivos grandes.' : 'Não feche esta página.'}
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-xs tracking-widest transition-all disabled:opacity-50 uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {isUploading ? (uploadPhase === 'processing' ? 'Finalizando...' : 'Enviando...') : 'Finalizar e Enviar'}
            </button>
            
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isUploading}
              className="w-full py-4 text-gray-400 hover:text-gray-600 font-semibold text-[10px] tracking-[0.2em] transition-all uppercase disabled:opacity-30"
            >
              Cancelar Envio
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

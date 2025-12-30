'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Video, FileVideo, Info, ShieldCheck, FolderPlus, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'
import { getSystemProfileIdSync } from '@/lib/utils/system'

export default function UploadMotionPage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false)
  const [newCollectionTitle, setNewCollectionTitle] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    keywords: '',
    is_premium: false,
    is_official: false,
    collection_id: '',
  })

  const [projectZip, setProjectZip] = useState<File | null>(null)
  const [previewVideo, setPreviewVideo] = useState<File | null>(null)
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [uploadStats, setUploadStats] = useState({
    bytesUploaded: 0,
    totalBytes: 0,
    speed: 0,
    elapsedTime: 0,
    remainingTime: 0,
  })
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Carregar categorias de motions
  useEffect(() => {
    async function loadCategories() {
      try {
        // Buscar categoria "Motions" ou "Motions" e suas subcategorias
        const { data: motionsCategory } = await supabase
          .from('categories')
          .select('id')
          .or('slug.eq.motions,slug.eq.motion')
          .is('parent_id', null)
          .maybeSingle()
        
        if (motionsCategory) {
          // Buscar a categoria principal
          const { data: mainCat } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('id', motionsCategory.id)
            .single()
          
          // Buscar subcategorias
          const { data: subCats } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('parent_id', motionsCategory.id)
            .order('order_index', { ascending: true })
            .order('name', { ascending: true })
          
          // Combinar categoria principal e subcategorias
          const motionCategories = [
            ...(mainCat ? [mainCat] : []),
            ...(subCats || [])
          ]
          setCategories(motionCategories)
        } else {
          // Fallback: buscar todas as categorias
          const { data: cats } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .order('name')
          setCategories(cats || [])
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }

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

          // Carregar coleções do usuário
          const { data: collectionsData } = await supabase
            .from('collections')
            .select('*')
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false })
          setCollections(collectionsData || [])
        }

        await loadCategories()
      } catch (error) {
        console.error('Error loading initial data:', error)
      }
    }

    loadInitialData()
  }, [supabase])

  function handleProjectZipSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar formato .zip
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (fileExtension !== '.zip') {
      toast.error('Formato inválido. Use apenas arquivos .zip contendo o projeto completo')
      return
    }

    if (file.size > 1000 * 1024 * 1024) { // 1GB
      toast.error('Arquivo muito grande (máx. 1GB)')
      return
    }

    setProjectZip(file)

    // Auto-preencher título se vazio
    if (!formData.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      setFormData(prev => ({ ...prev, title: fileName }))
    }

    // Gerar conteúdo com IA (passar o arquivo diretamente para evitar race condition)
    setTimeout(() => {
      generateContentWithAI(file)
    }, 100)
  }

  function handlePreviewVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar formato de vídeo
    const validExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!validExtensions.includes(fileExtension)) {
      toast.error(`Formato inválido: ${fileExtension}. Use MP4, MOV, AVI, WEBM ou MKV.`)
      return
    }

    if (file.size > 200 * 1024 * 1024) { // 200MB
      toast.error('Vídeo muito grande (máx. 200MB)')
      return
    }

    setPreviewVideo(file)
    
    // Criar preview URL para exibição
    const videoUrl = URL.createObjectURL(file)
    setPreviewVideoUrl(videoUrl)
  }

  // Upload direto para S3 usando presigned URL (para arquivos grandes)
  async function uploadDirectToS3(file: File, type: 'resource' | 'thumbnail'): Promise<any> {
    const startTime = Date.now()
    let lastLoaded = 0
    let lastTime = startTime
    let speed = 0

    // 1. Obter presigned URL
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const presignedResponse = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        type: type
      })
    })

    if (!presignedResponse.ok) {
      const error = await presignedResponse.json()
      throw new Error(error.error || 'Erro ao gerar URL de upload')
    }

    const { presignedUrl, key, url } = await presignedResponse.json()

    // 2. Upload direto para S3
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const currentTime = Date.now()
          const timeDelta = (currentTime - lastTime) / 1000
          const bytesDelta = e.loaded - lastLoaded

          if (timeDelta > 0 && bytesDelta > 0) {
            const instantSpeed = bytesDelta / timeDelta
            speed = speed === 0 ? instantSpeed : (speed * 0.7 + instantSpeed * 0.3)
          }

          const elapsedTime = (currentTime - startTime) / 1000
          const remainingBytes = e.total - e.loaded
          const remainingTime = speed > 0 ? remainingBytes / speed : 0

          const uploadPercent = (e.loaded / e.total) * 100
          const displayPercent = Math.min(95, Math.round(uploadPercent))

          setUploadProgress(displayPercent)
          setUploadStats({
            bytesUploaded: e.loaded,
            totalBytes: e.total,
            speed: speed,
            elapsedTime: elapsedTime,
            remainingTime: remainingTime,
          })

          lastLoaded = e.loaded
          lastTime = currentTime
        }
      })

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100)
          resolve({ 
            url, 
            key, 
            previewUrl: null, 
            thumbnailUrl: null,
          })
        } else {
          reject(new Error(`Erro ${xhr.status} no upload`))
        }
      }

      xhr.onerror = () => {
        if (xhr.status === 403) {
          reject(new Error('Acesso negado: A presigned URL pode ter expirado. Tente novamente.'))
        } else {
          reject(new Error(`Erro de conexão: ${xhr.statusText || 'Verifique sua conexão'}`))
        }
      }
      
      xhr.ontimeout = () => {
        reject(new Error('Tempo de upload excedido. Tente novamente.'))
      }

      xhr.timeout = 1800000 // 30 minutos para arquivos grandes
      
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  function uploadWithProgress(file: File, type: 'resource' | 'thumbnail'): Promise<any> {
    // Para arquivos > 4.5MB, usar upload direto para S3 (contorna limite do Next.js/Vercel)
    const LARGE_FILE_THRESHOLD = 4.5 * 1024 * 1024 // 4.5MB
    if (file.size > LARGE_FILE_THRESHOLD) {
      console.log('📦 Arquivo grande detectado (>4.5MB), usando upload direto para S3')
      return uploadDirectToS3(file, type)
    }

    // Para arquivos menores, usar o fluxo normal
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(percent)
        }
      })

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (error) {
            reject(new Error('Erro ao processar resposta do servidor'))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || `Erro ${xhr.status}`))
          } catch {
            reject(new Error(`Erro ${xhr.status}`))
          }
        }
      }

      xhr.onerror = () => reject(new Error('Erro de conexão'))
      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    })
  }

  async function generateContentWithAI(zipFile?: File) {
    const fileToUse = zipFile || projectZip
    if (!fileToUse) {
      toast.error('Selecione um arquivo ZIP do projeto primeiro')
      return
    }

    setIsAiProcessing(true)
    setAiError(null)

    try {
      const fileName = fileToUse.name
      const fileExtension = 'zip'
      const fileSize = fileToUse.size

      // Preparar metadados do motion
      const metadata = {
        fileName,
        fileExtension: fileExtension.toUpperCase(),
        fileSize,
        format: fileExtension,
        isProjectPackage: true,
      }

      // Buscar categorias de motions
      const { data: motionsCategory } = await supabase
        .from('categories')
        .select('id')
        .or('slug.eq.motions,slug.eq.motion')
        .is('parent_id', null)
        .maybeSingle()
      
      let categoriesList: any[] = []
      if (motionsCategory) {
        const { data: mainCat } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('id', motionsCategory.id)
          .single()
        
        const { data: subCats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('parent_id', motionsCategory.id)
          .order('order_index', { ascending: true })
        
        categoriesList = [
          ...(mainCat ? [mainCat] : []),
          ...(subCats || [])
        ]
      }

      // Chamar API de IA
      const aiResponse = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata,
          fileName,
          categories: categoriesList,
          resourceType: 'motion',
          generateDescription: false
        }),
      })

      if (!aiResponse.ok) {
        throw new Error('Erro ao gerar conteúdo com IA')
      }

      const aiData = await aiResponse.json()

      // Atualizar formulário com dados da IA
      if (aiData.title) {
        setFormData(prev => ({ ...prev, title: aiData.title }))
      }
      
      if (aiData.keywords && aiData.keywords.length > 0) {
        setFormData(prev => ({ ...prev, keywords: aiData.keywords.join(', ') }))
      }
      
      if (aiData.category_id || (aiData.category_ids && aiData.category_ids.length > 0)) {
        const categoryId = aiData.category_id || aiData.category_ids[0]
        setFormData(prev => ({ ...prev, category_id: categoryId }))
      }

      toast.success('Análise pela IA concluída!')
    } catch (error: any) {
      console.error('AI generation error:', error)
      setAiError(error.message || 'Erro ao gerar conteúdo com IA')
      toast.error('Erro ao gerar conteúdo com IA. Preencha manualmente.')
    } finally {
      setIsAiProcessing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!projectZip) {
      toast.error('Selecione um arquivo ZIP do projeto')
      return
    }

    if (!previewVideo) {
      toast.error('Selecione um vídeo de preview')
      return
    }

    if (!formData.title.trim()) {
      toast.error('Digite um título para o motion')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const keywordsArray = formData.keywords
        ? formData.keywords.split(',').map(k => k.trim()).filter(k => k)
        : []

      // Se for oficial, usar o perfil do sistema como criador
      const creatorId = formData.is_official ? getSystemProfileIdSync() : user.id

      // 1. Upload do arquivo ZIP do projeto (usa upload direto se > 4.5MB)
      setUploadProgress(5)
      let zipUploadData: any
      try {
        zipUploadData = await uploadWithProgress(projectZip, 'resource')
        setUploadProgress(50)
      } catch (error: any) {
        throw new Error(error.message || 'Erro ao fazer upload do arquivo ZIP')
      }

      // 2. Upload do vídeo preview (sem marca d'água)
      // Para vídeos, sempre usar o fluxo normal da API (que processa sem marca d'água quando noWatermark=true)
      setUploadProgress(55)
      let videoUploadData: any
      let videoMetadata: { width?: number; height?: number; duration?: number } | null = null
      
      try {
        // Extrair metadados do vídeo antes do upload para salvar dimensões
        const extractVideoMetadata = (file: File): Promise<{ width: number; height: number; duration: number } | null> => {
          return new Promise((resolve) => {
            const video = document.createElement('video')
            video.preload = 'metadata'
            video.src = URL.createObjectURL(file)
            
            video.onloadedmetadata = () => {
              URL.revokeObjectURL(video.src)
              resolve({
                width: video.videoWidth,
                height: video.videoHeight,
                duration: Math.round(video.duration)
              })
            }
            
            video.onerror = () => {
              URL.revokeObjectURL(video.src)
              resolve(null)
            }
            
            // Timeout de 5 segundos
            setTimeout(() => {
              URL.revokeObjectURL(video.src)
              resolve(null)
            }, 5000)
          })
        }
        
        // Extrair metadados do vídeo preview
        videoMetadata = await extractVideoMetadata(previewVideo)
        console.log('📹 Video preview metadata:', videoMetadata)
        
        const videoFormData = new FormData()
        videoFormData.append('file', previewVideo)
        videoFormData.append('type', 'resource')
        videoFormData.append('noWatermark', 'true')

        // Verificar se o vídeo é grande (>4.5MB)
        const LARGE_FILE_THRESHOLD = 4.5 * 1024 * 1024
        if (previewVideo.size > LARGE_FILE_THRESHOLD) {
          // Para vídeos grandes, usar upload direto (mas sem processamento de marca d'água)
          videoUploadData = await uploadDirectToS3(previewVideo, 'resource')
          // Adicionar metadados manualmente se não vierem do upload direto
          if (videoMetadata && !videoUploadData.videoMetadata) {
            videoUploadData.videoMetadata = videoMetadata
          }
        } else {
          // Para vídeos pequenos, usar API normal (que processa sem marca d'água)
          const videoUploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: videoFormData,
          })

          if (!videoUploadResponse.ok) {
            const errorData = await videoUploadResponse.json()
            throw new Error(errorData.error || 'Erro ao fazer upload do vídeo preview')
          }

          videoUploadData = await videoUploadResponse.json()
          // Se a API não retornou metadados, usar os que extraímos
          if (videoMetadata && !videoUploadData.videoMetadata) {
            videoUploadData.videoMetadata = videoMetadata
          }
        }
        setUploadProgress(80)
      } catch (error: any) {
        throw new Error(error.message || 'Erro ao fazer upload do vídeo preview')
      }

      // 3. Criar recurso no banco
      // Usar metadados do vídeo preview para salvar width/height
      const videoWidth = videoMetadata?.width || videoUploadData.videoMetadata?.width || null
      const videoHeight = videoMetadata?.height || videoUploadData.videoMetadata?.height || null
      const videoDuration = videoMetadata?.duration || videoUploadData.videoMetadata?.duration || null
      
      const { data: resource, error: resourceError } = await supabase
        .from('resources')
        .insert({
          title: formData.title,
          description: formData.description || null,
          resource_type: 'motion',
          category_id: formData.category_id || null,
          creator_id: creatorId,
          file_url: zipUploadData.url, // URL do arquivo ZIP do projeto
          preview_url: videoUploadData.url, // URL do vídeo preview (sem marca d'água)
          file_size: projectZip.size,
          file_format: 'zip',
          width: videoWidth, // Dimensões do vídeo preview
          height: videoHeight, // Dimensões do vídeo preview
          duration: videoDuration, // Duração do vídeo preview
          keywords: keywordsArray.length > 0 ? keywordsArray : null,
          is_premium: formData.is_premium,
          is_official: formData.is_official,
          status: userProfile?.is_admin ? 'approved' : 'pending',
        })
        .select()
        .single()

      if (resourceError) throw resourceError

      setUploadProgress(90)

      // 4. Adicionar à coleção se selecionada
      if (formData.collection_id && resource) {
        const { error: collectionError } = await supabase
          .from('collection_resources')
          .insert({
            collection_id: formData.collection_id,
            resource_id: resource.id,
            order_index: 0,
          })

        if (collectionError) {
          console.error('Error adding to collection:', collectionError)
        }
      }

      setUploadProgress(100)
      toast.success('Motion enviado com sucesso! Aguardando aprovação.')
      
      // Limpar formulário
      setFormData({
        title: '',
        description: '',
        category_id: '',
        keywords: '',
        is_premium: false,
        is_official: false,
        collection_id: '',
      })
      setProjectZip(null)
      setPreviewVideo(null)
      if (previewVideoUrl) {
        URL.revokeObjectURL(previewVideoUrl)
        setPreviewVideoUrl(null)
      }
      
      // Redirecionar após 1 segundo
      setTimeout(() => {
        router.push('/creator/resources')
      }, 1000)
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Erro ao fazer upload do motion')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  async function createNewCollection() {
    if (!newCollectionTitle.trim()) {
      toast.error('Digite um nome para a coleção')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: collection, error } = await supabase
        .from('collections')
        .insert({
          title: newCollectionTitle,
          description: '',
          creator_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      setCollections(prev => [collection, ...prev])
      setFormData(prev => ({ ...prev, collection_id: collection.id }))
      setNewCollectionTitle('')
      setShowNewCollectionForm(false)
      toast.success('Coleção criada com sucesso!')
    } catch (error: any) {
      console.error('Error creating collection:', error)
      toast.error(error.message || 'Erro ao criar coleção')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Upload de Motion</h1>
        <p className="text-gray-400 font-medium text-sm tracking-wider">
          Envie seus projetos de After Effects e Premiere para a comunidade BrasilPSD
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload do Arquivo ZIP do Projeto */}
        <Card className="p-8">
          <div className="flex items-center mb-6">
            <FileVideo className="h-6 w-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              Projeto Completo (ZIP)
            </h2>
          </div>

          {!projectZip ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className="w-12 h-12 mb-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                <p className="mb-2 text-sm font-semibold text-gray-500">
                  <span className="font-bold text-primary-500">Clique para fazer upload</span> ou arraste o arquivo
                </p>
                <p className="text-xs text-gray-400">
                  Formato suportado: .zip contendo o projeto completo (máx. 1GB)
                </p>
                <p className="text-xs text-primary-600 font-medium mt-2">
                  💡 Inclua todos os arquivos: .aep, fontes, imagens, vídeos, plugins, etc.
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".zip"
                onChange={handleProjectZipSelect}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3 flex-1">
                <FileVideo className="h-8 w-8 text-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{projectZip.name}</p>
                  <p className="text-xs text-gray-500">
                    {(projectZip.size / 1024 / 1024).toFixed(2)} MB • ZIP
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProjectZip(null)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </Card>

        {/* Upload do Vídeo Preview */}
        <Card className="p-8">
          <div className="flex items-center mb-6">
            <Video className="h-6 w-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              Vídeo Preview
            </h2>
          </div>

          {!previewVideo ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className="w-12 h-12 mb-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                <p className="mb-2 text-sm font-semibold text-gray-500">
                  <span className="font-bold text-primary-500">Clique para fazer upload</span> ou arraste o vídeo
                </p>
                <p className="text-xs text-gray-400">
                  Formatos suportados: MP4, MOV, AVI, WEBM, MKV (máx. 200MB)
                </p>
                <p className="text-xs text-primary-600 font-medium mt-2">
                  💡 O vídeo preview será exibido sem marca d'água
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="video/*,.mp4,.mov,.avi,.webm,.mkv"
                onChange={handlePreviewVideoSelect}
              />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3 flex-1">
                  <Video className="h-8 w-8 text-primary-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{previewVideo.name}</p>
                    <p className="text-xs text-gray-500">
                      {(previewVideo.size / 1024 / 1024).toFixed(2)} MB • {previewVideo.name.split('.').pop()?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewVideo(null)
                    if (previewVideoUrl) {
                      URL.revokeObjectURL(previewVideoUrl)
                      setPreviewVideoUrl(null)
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Preview do Vídeo */}
              {previewVideoUrl && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <video
                    src={previewVideoUrl}
                    controls
                    className="w-full rounded-lg"
                    style={{ maxHeight: '400px' }}
                  />
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Informações Básicas */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              Informações do Motion
            </h2>
            {projectZip && (
              <Button
                type="button"
                onClick={generateContentWithAI}
                disabled={isAiProcessing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Sparkles className={`h-4 w-4 ${isAiProcessing ? 'animate-spin' : ''}`} />
                {isAiProcessing ? 'Analisando...' : 'Análise pela IA'}
              </Button>
            )}
          </div>

          {aiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {aiError}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                Título *
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Transição Cinemática"
                required
                className="h-14"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o motion, seu uso, estilo..."
                rows={4}
                className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-3 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                Categoria
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all appearance-none"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                Palavras-chave
              </label>
              <Input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="Ex: transição, cinemático, efeito (separadas por vírgula)"
                className="h-14"
              />
              <p className="mt-2 text-xs text-gray-500">
                Separe as palavras-chave por vírgula
              </p>
            </div>
          </div>
        </Card>

        {/* Opções Adicionais */}
        <Card className="p-8">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tighter mb-6">
            Opções
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-900">Motion Premium</p>
                <p className="text-xs text-gray-500">Este motion requer assinatura premium para download</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_premium}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_premium: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            {userProfile?.is_admin && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    Motion Oficial
                    <ShieldCheck className="h-4 w-4 text-primary-500" />
                  </p>
                  <p className="text-xs text-gray-500">Marcar como motion oficial do BrasilPSD</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_official}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_official: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                Adicionar à Coleção (opcional)
              </label>
              {!showNewCollectionForm ? (
                <div className="flex gap-2">
                  <select
                    value={formData.collection_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, collection_id: e.target.value }))}
                    className="flex-1 h-14 rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all appearance-none"
                  >
                    <option value="">Nenhuma coleção</option>
                    {collections.map(collection => (
                      <option key={collection.id} value={collection.id}>
                        {collection.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCollectionForm(true)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Nova
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newCollectionTitle}
                    onChange={(e) => setNewCollectionTitle(e.target.value)}
                    placeholder="Nome da nova coleção"
                    className="flex-1 h-14"
                  />
                  <Button
                    type="button"
                    onClick={createNewCollection}
                    variant="primary"
                    className="h-14"
                  >
                    Criar
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCollectionForm(false)
                      setNewCollectionTitle('')
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Botão de Submit */}
        <div className="flex items-center justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isUploading || !projectZip || !previewVideo}
            isLoading={isUploading}
            className="min-w-[200px]"
          >
            {isUploading 
              ? `Enviando... ${Math.round(uploadProgress)}%` 
              : 'Enviar Motion'}
          </Button>
        </div>
      </form>
    </div>
  )
}


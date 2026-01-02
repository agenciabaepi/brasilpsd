'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Image as ImageIcon, Info, ShieldCheck, FolderPlus, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ResourceType, Profile } from '@/types/database'
import { getSystemProfileIdSync } from '@/lib/utils/system'

export default function UploadResourcePage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false)
  const [newCollectionTitle, setNewCollectionTitle] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    resource_type: 'image' as ResourceType,
    category_id: '',
    keywords: '',
    is_premium: false,
    is_official: false,
    collection_id: '',
  })

  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<{ 
    width?: number
    height?: number
    duration?: number
    frameRate?: number
    hasAlpha?: boolean
    hasLoop?: boolean
    encoding?: string
    orientation?: string
    codec?: string
    codecName?: string
    colorSpace?: string
    hasTimecode?: boolean
    audioCodec?: string
  } | null>(null)
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
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiAbortControllerRef = useRef<AbortController | null>(null)
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Função para obter descrição padrão baseada no tipo de arquivo
  function getDefaultDescription(resourceType: ResourceType, fileFormat?: string): string {
    const format = fileFormat?.toLowerCase() || ''
    
    switch (resourceType) {
      case 'psd':
        return 'Arquivo PSD editável do Photoshop. Perfeito para designers que precisam de flexibilidade total na edição. Inclui todas as camadas organizadas e prontas para personalização.'
      
      case 'ai':
        if (format === 'eps') {
          return 'Arquivo EPS (Encapsulated PostScript) vetorial de alta qualidade. Compatível com Adobe Illustrator e outros softwares de design vetorial. Ideal para impressão e escalonamento sem perda de qualidade.'
        }
        return 'Arquivo AI (Adobe Illustrator) vetorial editável. Perfeito para designers que precisam de gráficos escaláveis e editáveis. Inclui todas as camadas e elementos organizados.'
      
      case 'image':
        return 'Imagem de alta qualidade pronta para uso em seus projetos. Formatos otimizados para web e impressão, com cores vibrantes e detalhes nítidos.'
      
      case 'png':
        return 'Imagem PNG com fundo transparente. Perfeita para uso em designs onde você precisa de transparência. Alta qualidade e compatível com todos os principais softwares de design.'
      
      case 'video':
        return 'Vídeo profissional de alta qualidade. Pronto para uso em projetos de marketing, apresentações e conteúdo digital. Formatos otimizados para diferentes plataformas.'
      
      case 'audio':
        return 'Áudio profissional de alta qualidade. Efeitos sonoros, músicas e trilhas prontas para uso em seus projetos. Formatos otimizados para diferentes necessidades.'
      
      case 'font':
        return 'Fonte tipográfica profissional. Compatível com Windows, Mac e Linux. Inclui todos os caracteres e variações necessárias para uso em projetos de design.'
      
      case 'motion':
        return 'Animação e motion graphics profissionais. Prontos para uso em projetos de vídeo, apresentações e conteúdo digital. Formatos otimizados para diferentes plataformas.'
      
      default:
        return 'Recurso profissional de alta qualidade, pronto para uso em seus projetos de design.'
    }
  }

  // Função para carregar todas as categorias cadastradas
  async function loadAllCategories() {
    try {
      // Buscar todas as categorias principais
      const { data: mainCategories, error: mainError } = await supabase
        .from('categories')
        .select('id, name, parent_id, slug, order_index')
        .is('parent_id', null)
        .order('order_index', { ascending: true })
      
      if (mainError) throw mainError

      // Buscar todas as subcategorias (apenas de PSD por enquanto)
      const { data: subCategories, error: subError } = await supabase
        .from('categories')
        .select('id, name, parent_id, slug, order_index')
        .not('parent_id', 'is', null)
        .order('order_index', { ascending: true })
      
      if (subError) throw subError

      // Combinar todas as categorias
      setCategories([
        ...(mainCategories || []),
        ...(subCategories || [])
      ])
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error)
      // Fallback: buscar apenas categorias principais
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, parent_id, slug, order_index')
        .is('parent_id', null)
        .order('order_index', { ascending: true })
      setCategories(cats || [])
    }
  }

  // Função para carregar categorias baseado no tipo de recurso (mantida para compatibilidade)
  async function loadCategoriesForType(resourceType: ResourceType) {
    // Sempre carregar todas as categorias para o usuário escolher
    await loadAllCategories()
  }

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

        // Carregar todas as categorias cadastradas
        await loadAllCategories()

        // Carregar coleções do usuário (com is_premium)
        if (user) {
          const { data: userCollections, error: collectionsError } = await supabase
            .from('collections')
            .select('id, title, is_premium')
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false })
          
          if (!collectionsError) {
            setCollections(userCollections || [])
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error)
      }
    }
    
    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quando uma coleção for selecionada, buscar se ela é premium e marcar automaticamente
  useEffect(() => {
    if (!formData.collection_id || collections.length === 0) {
      return
    }

    const selectedCollection = collections.find(c => c.id === formData.collection_id)
    if (selectedCollection) {
      // Se a coleção é premium, marcar automaticamente e não permitir alteração
      if (selectedCollection.is_premium) {
        setFormData(prev => ({ ...prev, is_premium: true }))
      }
      // Se a coleção não for premium, manter o valor atual (permitir que o usuário escolha)
    }
  }, [formData.collection_id, collections])

  // Verificar se a coleção selecionada é premium ou se é oficial para desabilitar o checkbox
  const selectedCollection = collections.find(c => c.id === formData.collection_id)
  const isPremiumCollection = selectedCollection?.is_premium || false
  const isOfficial = formData.is_official
  const isPremiumLocked = isPremiumCollection || isOfficial

  // Atualizar tempo decorrido durante o processamento
  useEffect(() => {
    if (uploadPhase === 'processing' && uploadStats.startTime > 0) {
      const interval = setInterval(() => {
        setUploadStats(prev => ({
          ...prev,
          elapsedTime: (Date.now() - prev.startTime) / 1000,
        }))
      }, 500) // Atualizar a cada 500ms

      return () => clearInterval(interval)
    }
  }, [uploadPhase, uploadStats.startTime])

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
            startTime: startTime,
          })

          lastLoaded = e.loaded
          lastTime = currentTime
        }
      })

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Upload direto concluído
          setUploadProgress(100)
          
          // Para vídeos, o processamento será enfileirado após salvar no banco (ver handleSubmit)
          // Retornar dados básicos para permitir continuar com o fluxo
          resolve({ 
            url, 
            key, 
            previewUrl: null, 
            thumbnailUrl: null, 
            videoMetadata: null,
            isAiGenerated: false,
            processing: type === 'resource' && file.type.startsWith('video/') ? 'queued' : undefined
          })
        } else {
          reject(new Error(`Erro ${xhr.status} no upload`))
        }
      }

      xhr.onerror = (e) => {
        console.error('❌ XHR upload error:', {
          status: xhr.status,
          statusText: xhr.statusText,
          readyState: xhr.readyState,
          responseText: xhr.responseText?.substring(0, 200),
          presignedUrl: presignedUrl?.substring(0, 100) + '...'
        })
        
        // Verificar se é erro CORS
        if (xhr.status === 0 && !xhr.responseText) {
          reject(new Error('Erro de conexão: Possível problema de CORS no bucket S3. Verifique as configurações CORS do bucket.'))
        } else if (xhr.status === 403) {
          reject(new Error('Acesso negado: A presigned URL pode ter expirado ou estar inválida. Tente novamente.'))
        } else if (xhr.status === 400) {
          reject(new Error(`Erro na requisição: ${xhr.responseText || 'Verifique o arquivo e tente novamente'}`))
        } else {
          reject(new Error(`Erro de conexão (${xhr.status || 'network'}): ${xhr.statusText || 'Verifique sua conexão e tente novamente'}`))
        }
      }
      
      xhr.ontimeout = () => {
        console.error('⏱️ XHR upload timeout')
        reject(new Error('Tempo de upload excedido. O arquivo pode ser muito grande ou a conexão está lenta. Tente novamente.'))
      }

      xhr.timeout = 1800000 // 30 minutos para arquivos grandes
      
      // Log antes de iniciar upload
      console.log('📤 Iniciando upload direto ao S3:', {
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        contentType: file.type,
        presignedUrlLength: presignedUrl?.length
      })
      
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  function uploadWithProgress(file: File, type: 'resource' | 'thumbnail'): Promise<any> {
    // Para arquivos > 4.5MB, usar upload direto para S3 (contorna limite do Next.js/Vercel)
    // O Next.js/Vercel tem limite de 4.5MB para body de requisições
    const LARGE_FILE_THRESHOLD = 4.5 * 1024 * 1024 // 4.5MB
    if (file.size > LARGE_FILE_THRESHOLD) {
      console.log('📦 Arquivo grande detectado (>4.5MB), usando upload direto para S3')
      return uploadDirectToS3(file, type)
    }

    // Para arquivos menores ou iguais a 4.5MB, usar o fluxo atual (processamento no servidor)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)

      const startTime = Date.now()
      let lastLoaded = 0
      let lastTime = startTime
      let speed = 0
      let processingInterval: NodeJS.Timeout | null = null
      let bytesUploadComplete = false

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
          if (timeDelta > 0 && bytesDelta > 0) {
            const instantSpeed = bytesDelta / timeDelta
            // Suavizar a velocidade com média móvel
            speed = speed === 0 ? instantSpeed : (speed * 0.7 + instantSpeed * 0.3)
          }

          const elapsedTime = (currentTime - startTime) / 1000
          const remainingBytes = e.total - e.loaded
          const remainingTime = speed > 0 ? remainingBytes / speed : 0

          // Mostrar apenas até 90% durante o upload dos bytes
          // Os outros 10% serão durante o processamento no servidor
          const uploadPercent = (e.loaded / e.total) * 100
          const displayPercent = Math.min(90, Math.round(uploadPercent))
          
          // Forçar atualização imediata do estado
          setUploadProgress(displayPercent)
          setUploadStats(prev => ({
            bytesUploaded: e.loaded,
            totalBytes: e.total,
            speed: speed,
            elapsedTime: elapsedTime,
            remainingTime: remainingTime,
            startTime: prev.startTime || startTime,
          }))

          lastLoaded = e.loaded
          lastTime = currentTime
          
          // Log para debug
          if (e.loaded % (1024 * 1024) < 10000 || e.loaded === e.total) {
            console.log('📊 Upload progress:', {
              loaded: `${(e.loaded / (1024 * 1024)).toFixed(2)} MB`,
              total: `${(e.total / (1024 * 1024)).toFixed(2)} MB`,
              percent: `${uploadPercent.toFixed(1)}%`,
              speed: `${(speed / (1024 * 1024)).toFixed(2)} MB/s`
            })
          }

          // Quando terminar de enviar os bytes, mudar para processing
          if (uploadPercent >= 99.9 && !bytesUploadComplete) {
            bytesUploadComplete = true
            setUploadPhase('processing')
            setUploadProgress(88) // Mostrar 88% quando começar processamento
            
            // Iniciar progresso simulado durante processamento
            const processingStartTime = Date.now()
            let lastProgress = 90
            
            processingInterval = setInterval(() => {
              const processingElapsed = (Date.now() - processingStartTime) / 1000
              
              // Simular progresso gradual de 90% a 99%
              // Para vídeos grandes, pode levar mais tempo
              const estimatedProcessingTime = Math.max(5, Math.min(30, file.size / (30 * 1024 * 1024))) // 5-30s dependendo do tamanho
              const processingProgress = Math.min(99, 90 + (processingElapsed / estimatedProcessingTime) * 9)
              
              // Só atualizar se o progresso aumentou (evitar regressão)
              if (processingProgress > lastProgress) {
                setUploadProgress(Math.round(processingProgress))
                lastProgress = processingProgress
              }
              
              // Limpar intervalo quando a requisição terminar
              if (xhr.readyState === 4) {
                if (processingInterval) {
                  clearInterval(processingInterval)
                  processingInterval = null
                }
              }
            }, 300) // Atualizar a cada 300ms
            
            // Limpar intervalo após 60 segundos (timeout de segurança para arquivos muito grandes)
            setTimeout(() => {
              if (processingInterval) {
                clearInterval(processingInterval)
                processingInterval = null
              }
            }, 60000)
          }
        }
      })

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          console.log('XHR request completed, status:', xhr.status)
          
          // Limpar intervalo de processamento se ainda estiver rodando
          if (processingInterval) {
            clearInterval(processingInterval)
            processingInterval = null
          }
          
          // Quando a requisição realmente terminar, mostrar 100%
          setUploadProgress(100)
          setUploadPhase('processing')
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              console.log('Upload response received:', response)
              resolve(response)
            } catch (err) {
              console.error('Error parsing response:', err)
              reject(new Error('Resposta inválida do servidor'))
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              console.error('Upload error response:', errorData)
              
              // Tratamento específico para erro 413 (Content Too Large)
              if (xhr.status === 413 || errorData.error?.includes('413') || errorData.error?.includes('muito grande')) {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
                reject(new Error(`Arquivo muito grande (${fileSizeMB}MB). O limite máximo é 4.5MB para upload direto. Por favor, reduza o tamanho do arquivo ou use um formato mais compacto.`))
              } else {
                reject(new Error(errorData.error || errorData.message || 'Erro no upload'))
              }
            } catch (err) {
              console.error('Error parsing error response:', err)
              
              // Tratamento específico para erro 413 quando não é possível parsear JSON
              if (xhr.status === 413) {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
                reject(new Error(`Arquivo muito grande (${fileSizeMB}MB). O limite máximo é 4.5MB. Por favor, reduza o tamanho do arquivo.`))
              } else {
                reject(new Error(`Erro ${xhr.status} no servidor`))
              }
            }
          }
        }
      }

      xhr.onerror = () => {
        console.error('XHR network error')
        reject(new Error('Erro de conexão'))
      }
      
      xhr.ontimeout = () => {
        console.error('XHR timeout')
        reject(new Error('Tempo de upload excedido. Tente novamente.'))
      }
      
      // Timeout de 10 minutos para arquivos grandes
      xhr.timeout = 600000 // 10 minutos
      
      console.log('Starting XHR upload...', {
        fileSize: file.size,
        fileName: file.name,
        type: type
      })
      
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

    // Arquivos > 4.5MB serão enviados via upload direto ao S3 (presigned URL)
    // Não bloquear aqui, deixar o uploadWithProgress decidir o método
    
    // Validar se arquivo não-imagem tem thumbnail obrigatória (áudios não precisam)
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/') && !thumbnail) {
      toast.error('⚠️ Thumbnail obrigatória: Faça upload de uma thumbnail/imagem do conteúdo para arquivos PSD, AI, EPS, etc.')
      // Scroll para a seção de thumbnail
      setTimeout(() => {
        const thumbnailSection = document.querySelector('[data-thumbnail-section]')
        if (thumbnailSection) {
          thumbnailSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
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
      const previewUrl = fileData.previewUrl // URL da versão com marca d'água (se vídeo)
      // Thumbnail: usar o extraído automaticamente do vídeo se disponível, senão usar o upload manual
      let finalThumbnailUrl: string | null = fileData.thumbnailUrl || null
      const detectedAi = fileData.isAiGenerated
      
      // Determinar formato final: se foi convertido para MP4, usar mp4, senão usar extensão original
      const finalFileFormat = fileData.finalFormat || (fileData.wasConverted ? 'mp4' : file.name.split('.').pop() || '')
      
      // Usar metadados do servidor se disponíveis (mais confiável, especialmente após conversão)
      if (fileData.videoMetadata) {
        console.log('✅ Using server-extracted video metadata:', fileData.videoMetadata)
        setVideoMetadata(prev => ({
          ...prev,
          width: fileData.videoMetadata.width,
          height: fileData.videoMetadata.height,
          duration: fileData.videoMetadata.duration,
          frameRate: fileData.videoMetadata.frameRate,
          codec: fileData.videoMetadata.codec,
          codecName: fileData.videoMetadata.codecName,
          colorSpace: fileData.videoMetadata.colorSpace,
          hasTimecode: fileData.videoMetadata.hasTimecode,
          audioCodec: fileData.videoMetadata.audioCodec
        }))
      } else if (videoMetadata) {
        console.log('ℹ️ Using client-extracted video metadata:', videoMetadata)
      }

      // Processar metadados de áudio se disponíveis
      if (fileData.audioMetadata && formData.resource_type === 'audio') {
        console.log('✅ Using server-extracted audio metadata:', fileData.audioMetadata)
        if (fileData.audioMetadata.duration) {
          setVideoMetadata(prev => ({
            ...prev,
            duration: fileData.audioMetadata.duration
          }))
        }
      }
      
      console.log('File uploaded successfully:', {
        url: fileUrl,
        key: fileData.key,
        type: file.type,
        size: file.size,
        hasServerMetadata: !!fileData.videoMetadata,
        hasClientMetadata: !!videoMetadata
      })

      // 2. Upload da Capa (se houver e não foi extraída automaticamente do vídeo)
      let thumbAiDetected = false
      if (thumbnail && !finalThumbnailUrl) {
        console.log('📸 Uploading manual thumbnail (auto-extracted thumbnail not available)...')
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
        finalThumbnailUrl = thumbData.url
        thumbAiDetected = thumbData.isAiGenerated
      } else if (finalThumbnailUrl) {
        console.log('✅ Using auto-extracted thumbnail from video')
      }

      setUploadPhase('processing')
      setUploadProgress(100)

      // 3. Criar coleção se necessário (se foi preenchido o título da nova coleção)
      let collectionId = formData.collection_id
      if (newCollectionTitle.trim()) {
        const slug = newCollectionTitle
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')

        const { data: newCollection, error: collectionError } = await supabase
          .from('collections')
          .insert({
            creator_id: user.id,
            title: newCollectionTitle.trim(),
            slug: slug,
            is_premium: false,
            is_featured: false,
            status: 'pending'
          })
          .select()
          .single()

        if (collectionError) throw collectionError
        collectionId = newCollection.id
        setCollections([newCollection, ...collections])
        setShowNewCollectionForm(false)
        setNewCollectionTitle('')
      }

      // 4. Salvar no Banco
      // Se for oficial, usar o perfil do sistema como criador
      const creatorId = formData.is_official ? getSystemProfileIdSync() : user.id
      
      // Usar metadata de imagem do servidor se disponível, senão usar do vídeo
      const imageMetadata = fileData.imageMetadata
      const finalWidth = imageMetadata?.width 
        ? Number(imageMetadata.width) 
        : (videoMetadata?.width ? Number(videoMetadata.width) : null)
      const finalHeight = imageMetadata?.height 
        ? Number(imageMetadata.height) 
        : (videoMetadata?.height ? Number(videoMetadata.height) : null)
      
      // Obter descrição padrão baseada no tipo de arquivo
      const defaultDescription = getDefaultDescription(formData.resource_type, finalFileFormat)
      
      // Dados básicos do recurso (campos que sempre existem)
      const basicResourceData: any = {
        title: formData.title,
        description: defaultDescription, // Usar descrição padrão
        resource_type: formData.resource_type, // Manter o tipo selecionado (png, image, etc.)
        category_id: formData.category_id || null,
        creator_id: creatorId,
        file_url: fileUrl,
        preview_url: previewUrl || null, // Versão com marca d'água para preview
        thumbnail_url: finalThumbnailUrl || null, // Thumbnail extraído automaticamente ou upload manual
        file_size: file.size,
        file_format: finalFileFormat, // Usar formato final (mp4 se convertido, senão extensão original)
        width: finalWidth,
        height: finalHeight,
        duration: videoMetadata?.duration ? Math.round(Number(videoMetadata.duration)) : (fileData.audioMetadata?.duration ? Math.round(Number(fileData.audioMetadata.duration)) : null),
        keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        is_premium: formData.is_premium || false,
        is_official: formData.is_official || false,
        is_ai_generated: detectedAi || thumbAiDetected || false,
        status: userProfile?.is_admin ? 'approved' : 'pending',
      }
      
      console.log('💾 Saving resource to database:', {
        title: basicResourceData.title,
        resource_type: basicResourceData.resource_type,
        resource_type_type: typeof basicResourceData.resource_type,
        file_size: basicResourceData.file_size,
        file_url: basicResourceData.file_url?.substring(0, 50) + '...',
        has_video_metadata: !!videoMetadata
      })
      
      // Tentar inserir primeiro sem campos de vídeo extras (caso a migração não tenha sido aplicada)
      let resource, error
      
      // Garantir que resource_type seja uma string válida
      // IMPORTANTE: Para PNG, usar RPC que faz cast explícito no banco
      const resourceDataToInsert = {
        ...basicResourceData,
        resource_type: String(basicResourceData.resource_type) as ResourceType
      }
      
      console.log('📤 Inserting with resource_type:', resourceDataToInsert.resource_type, typeof resourceDataToInsert.resource_type)
      
      // Se for PNG, usar API route que faz insert direto no banco (contorna validação do cliente)
      if (resourceDataToInsert.resource_type === 'png') {
        console.log('📸 PNG detected - using API route for direct database insert')
        try {
          const response = await fetch('/api/resources/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resourceDataToInsert)
          })
          
          const result = await response.json()
          
          if (response.ok && result.data) {
            resource = result.data
            error = null
            console.log('✅ PNG resource inserted successfully via API route')
          } else {
            error = { message: result.error || 'Erro ao inserir via API' } as any
            console.error('❌ API route error:', result.error)
          }
        } catch (apiErr: any) {
          console.error('❌ Error calling API route:', apiErr)
          error = apiErr
        }
      } else {
        // Para outros tipos, usar insert normal
        const { data, error: insertError } = await supabase
          .from('resources')
          .insert(resourceDataToInsert)
          .select()
          .single()
        
        resource = data
        error = insertError
      }

      // Se deu certo, tentar atualizar com campos de vídeo se for vídeo
      if (!error && resource && formData.resource_type === 'video' && videoMetadata) {
        const videoUpdateData: any = {}
        
        if (videoMetadata.frameRate) videoUpdateData.frame_rate = Number(videoMetadata.frameRate)
        if (videoMetadata.hasAlpha !== undefined) videoUpdateData.has_alpha_channel = videoMetadata.hasAlpha
        if (videoMetadata.hasLoop !== undefined) videoUpdateData.has_loop = videoMetadata.hasLoop
        // Usar codec se disponível, senão usar encoding (para compatibilidade)
        if (videoMetadata.codec) {
          videoUpdateData.video_encoding = videoMetadata.codec
          videoUpdateData.video_codec = videoMetadata.codec // Campo adicional para codec formatado
        } else if (videoMetadata.encoding) {
          videoUpdateData.video_encoding = videoMetadata.encoding
        }
        if (videoMetadata.orientation) videoUpdateData.orientation = videoMetadata.orientation
        if (videoMetadata.colorSpace) videoUpdateData.video_color_space = videoMetadata.colorSpace
        if (videoMetadata.hasTimecode !== undefined) videoUpdateData.video_has_timecode = videoMetadata.hasTimecode
        if (videoMetadata.audioCodec) videoUpdateData.video_audio_codec = videoMetadata.audioCodec
        
        // Tentar atualizar com campos de vídeo (pode falhar se a migração não foi aplicada)
        if (Object.keys(videoUpdateData).length > 0) {
          const { error: updateError } = await supabase
            .from('resources')
            .update(videoUpdateData)
            .eq('id', resource.id)
          
          if (updateError) {
            console.warn('⚠️ Could not update video metadata fields (migration may not be applied):', updateError.message)
            // Não falhar o upload por isso, apenas logar o aviso
          } else {
            console.log('✅ Video metadata fields updated successfully')
          }
        }
      }

      if (error) {
        console.error('❌ Database insert error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(`Erro ao salvar no banco: ${error.message}${error.details ? ` (${error.details})` : ''}${error.hint ? ` - ${error.hint}` : ''}`)
      }
      
      console.log('✅ Resource saved successfully:', resource?.id)

      // 5. Se for vídeo, enfileirar processamento com resourceId (para processamento assíncrono via SQS)
      if (resource && formData.resource_type === 'video' && file.type.startsWith('video/')) {
        console.log('📤 Enfileirando processamento de vídeo com resourceId...')
        try {
          // Extrair key do fileUrl (pode ser URL completa ou apenas key)
          // O fileUrl pode estar em formato: https://bucket.s3.region.amazonaws.com/path/key
          // ou apenas: path/key
          let fileKey = fileUrl
          if (fileUrl.includes('amazonaws.com')) {
            // Se for URL completa, extrair a parte após o domínio
            const urlParts = fileUrl.split('.amazonaws.com/')
            fileKey = urlParts.length > 1 ? urlParts[1] : fileUrl.split('/').slice(-2).join('/')
          } else if (fileUrl.includes('/')) {
            // Se for apenas path, usar os últimos 2 segmentos (ex: resources/timestamp-random.ext)
            fileKey = fileUrl.split('/').slice(-2).join('/')
          }
          
          console.log('📤 Enviando para SQS:', { resourceId: resource.id, key: fileKey, fileName: file.name })
          
          const response = await fetch('/api/upload/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: fileKey,
              url: fileUrl,
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
              type: 'resource',
              resourceId: resource.id
            })
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log('✅ Processamento enfileirado com resourceId:', resource.id, result)
          } else {
            const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
            console.error('⚠️ Erro ao enfileirar processamento:', error)
          }
        } catch (err) {
          console.error('⚠️ Erro ao enfileirar processamento (não crítico):', err)
        }
      }

      // 6. Se for PNG, garantir que está associado à categoria "Imagens" também
      if (resource && formData.resource_type === 'png') {
        // Buscar categoria "Imagens"
        const { data: imagensCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', 'imagens')
          .is('parent_id', null)
          .maybeSingle()
        
        if (imagensCategory) {
          // Verificar se já está associado à categoria "Imagens"
          const categoryIdsToAssociate = [imagensCategory.id]
          
          // Se já tem uma categoria selecionada e não é "Imagens", adicionar "Imagens" também
          if (formData.category_id && formData.category_id !== imagensCategory.id) {
            categoryIdsToAssociate.push(formData.category_id)
          }
          
          // Associar categorias na tabela resource_categories (se existir)
          try {
            const categoryInserts = categoryIdsToAssociate.map(categoryId => ({
              resource_id: resource.id,
              category_id: categoryId
            }))
            
            const { error: categoriesError } = await supabase
              .from('resource_categories')
              .insert(categoryInserts)
            
            if (categoriesError) {
              console.warn('⚠️ Erro ao associar categoria "Imagens" ao PNG:', categoriesError)
              // Se a tabela não existir, apenas atualizar o category_id principal para "Imagens"
              if (formData.category_id !== imagensCategory.id) {
                const { error: updateError } = await supabase
                  .from('resources')
                  .update({ category_id: imagensCategory.id })
                  .eq('id', resource.id)
                
                if (updateError) {
                  console.warn('⚠️ Erro ao atualizar category_id para "Imagens":', updateError)
                } else {
                  console.log('✅ PNG: category_id atualizado para "Imagens"')
                }
              }
            } else {
              console.log('✅ PNG: Associado à categoria "Imagens" automaticamente')
            }
          } catch (err) {
            console.warn('⚠️ Erro ao associar categorias:', err)
            // Fallback: atualizar category_id principal
            if (formData.category_id !== imagensCategory.id) {
              await supabase
                .from('resources')
                .update({ category_id: imagensCategory.id })
                .eq('id', resource.id)
            }
          }
        }
      }

      // 6. Adicionar à coleção se selecionada
      if (collectionId && resource) {
        // Buscar o maior order_index da coleção para adicionar no final
        const { data: existingResources } = await supabase
          .from('collection_resources')
          .select('order_index')
          .eq('collection_id', collectionId)
          .order('order_index', { ascending: false })
          .limit(1)
        
        const nextOrderIndex = existingResources && existingResources.length > 0 
          ? (existingResources[0].order_index || 0) + 1 
          : 0

        const { error: collectionResourceError } = await supabase
          .from('collection_resources')
          .insert({
            collection_id: collectionId,
            resource_id: resource.id,
            order_index: nextOrderIndex
          })

        if (collectionResourceError) {
          console.error('Erro ao adicionar à coleção:', collectionResourceError)
          // Não falhar o upload se houver erro ao adicionar à coleção
        }
      }

      console.log('✅ All upload steps completed successfully')
      toast.success('Arquivo enviado com sucesso!')
      router.push('/creator/resources')
    } catch (error: any) {
      console.error('❌ Upload failed:', error)
      toast.error(error.message || 'Erro ao enviar recurso')
      setUploadPhase('idle')
      setUploadProgress(0)
      setIsUploading(false)
      setIsUploading(false)
    }
  }

  // Função para extrair título do nome do arquivo
  function extractTitleFromFilename(filename: string): string {
    // Remove a extensão
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    // Remove caracteres especiais e substitui por espaços
    const cleaned = nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // Capitaliza primeira letra de cada palavra
    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Função para extrair metadados de vídeo
  async function extractVideoMetadata(videoFile: File): Promise<{ width: number; height: number; duration: number } | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        })
      }
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(null)
      }
      
      video.src = URL.createObjectURL(videoFile)
    })
  }

  // Função para cancelar análise pela IA
  function cancelAiAnalysis() {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort()
      aiAbortControllerRef.current = null
    }
    setIsAiProcessing(false)
    const autoTitle = extractTitleFromFilename(file?.name || '')
    if (autoTitle && !formData.title) {
      setFormData(prev => ({ ...prev, title: autoTitle }))
    }
    toast('Análise pela IA cancelada. Preencha os campos manualmente.', { icon: 'ℹ️' })
  }

  // Função para gerar conteúdo com IA
  async function generateContentWithAI(file: File, previewBase64?: string) {
    setIsAiProcessing(true)
    setAiError(null)
    
    // Criar novo AbortController para esta análise
    aiAbortControllerRef.current = new AbortController()
    const signal = aiAbortControllerRef.current.signal
    
    // Timeout geral de 30 segundos
    const overallTimeout = setTimeout(() => {
      if (!signal.aborted) {
        aiAbortControllerRef.current?.abort()
        setIsAiProcessing(false)
        toast.error('Análise pela IA demorou muito. Preencha os campos manualmente.')
        const autoTitle = extractTitleFromFilename(file.name)
        if (autoTitle) {
          setFormData(prev => ({ ...prev, title: autoTitle }))
        }
      }
    }, 30000)
    
    try {
      // Detectar tipo de arquivo automaticamente
      let detectedType: ResourceType = 'image'
      if (file.type.startsWith('video/')) {
        detectedType = 'video'
      } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        detectedType = 'png'
      } else if (file.type.includes('psd') || file.name.toLowerCase().endsWith('.psd')) {
        detectedType = 'psd'
      } else if (file.type.includes('ai') || file.name.toLowerCase().endsWith('.ai') || file.name.toLowerCase().endsWith('.eps')) {
        detectedType = 'ai'
      } else if (file.type.includes('font') || file.name.toLowerCase().match(/\.(ttf|otf|woff|woff2)$/)) {
        detectedType = 'font'
      } else if (file.type.startsWith('audio/')) {
        detectedType = 'audio'
      }
      
      // Atualizar tipo de recurso
      setFormData(prev => ({ ...prev, resource_type: detectedType }))
      await loadCategoriesForType(detectedType)
      
      // Extrair metadados
      let metadata: any = {}
      
      if (file.type.startsWith('image/')) {
        // Extrair metadados de imagem com timeout
        const formData = new FormData()
        formData.append('file', file)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 segundos timeout
        
        // Combinar sinais: se a análise foi cancelada, cancelar também a extração de metadados
        const combinedSignal = signal.aborted ? signal : controller.signal
        
        try {
          const metadataResponse = await fetch('/api/image/extract-metadata', {
            method: 'POST',
            body: formData,
            signal: combinedSignal
          })
          
          if (metadataResponse.ok) {
            const { metadata: imageMetadata } = await metadataResponse.json()
            metadata = imageMetadata
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.warn('⏱️ Timeout na extração de metadados, continuando sem metadados')
          } else {
            console.error('Erro ao extrair metadados:', error)
          }
        } finally {
          clearTimeout(timeoutId)
        }
      }
      
      // Preparar imagem em base64 para análise visual
      let imageBase64: string | undefined
      
      // Função auxiliar para processar imagem para base64
      const processImageToBase64 = async (imageSrc: string): Promise<string | undefined> => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.src = imageSrc
          
          const timeoutId = setTimeout(() => {
            reject(new Error('Timeout ao processar imagem'))
          }, 5000) // 5 segundos timeout
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              const maxSize = 1024
              let width = img.width
              let height = img.height
              
              if (width > maxSize || height > maxSize) {
                if (width > height) {
                  height = (height * maxSize) / width
                  width = maxSize
                } else {
                  width = (width * maxSize) / height
                  height = maxSize
                }
              }
              
              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext('2d')
              ctx?.drawImage(img, 0, 0, width, height)
              
              const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
              clearTimeout(timeoutId)
              resolve(base64)
            } catch (error) {
              clearTimeout(timeoutId)
              reject(error)
            }
          }
          
          img.onerror = () => {
            clearTimeout(timeoutId)
            reject(new Error('Erro ao carregar imagem'))
          }
        })
      }
      
      // Se for imagem, usar o preview
      if (file.type.startsWith('image/') && previewBase64) {
        try {
          imageBase64 = await processImageToBase64(previewBase64)
        } catch (error) {
          console.warn('Erro ao processar imagem principal para base64:', error)
        }
      } 
      // Se não for imagem mas tiver thumbnail OU previewBase64 (passado como parâmetro), usar para análise
      else if (!file.type.startsWith('image/') && (previewBase64 || thumbnail)) {
        console.log('📸 Arquivo não é imagem, usando thumbnail/preview para análise pela IA')
        console.log('📊 previewBase64 disponível:', !!previewBase64)
        console.log('📊 thumbnail disponível:', !!thumbnail)
        console.log('📊 thumbnailPreview disponível:', !!thumbnailPreview)
        
        try {
          let thumbnailBase64ToUse: string | undefined
          
          // Priorizar previewBase64 se foi passado como parâmetro (mais confiável)
          if (previewBase64) {
            console.log('✅ Usando previewBase64 passado como parâmetro')
            thumbnailBase64ToUse = previewBase64
          } 
          // Se não, usar thumbnailPreview do estado
          else if (thumbnailPreview) {
            console.log('✅ Usando thumbnailPreview do estado')
            thumbnailBase64ToUse = thumbnailPreview
          }
          // Se não, processar a thumbnail agora
          else if (thumbnail) {
            console.log('⏳ Processando thumbnail agora...')
            const reader = new FileReader()
            thumbnailBase64ToUse = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(thumbnail)
            })
            setThumbnailPreview(thumbnailBase64ToUse)
          }
          
          if (thumbnailBase64ToUse) {
            imageBase64 = await processImageToBase64(thumbnailBase64ToUse)
            console.log('✅ Thumbnail processada para análise pela IA, tamanho base64:', imageBase64?.length || 0)
          } else {
            console.warn('⚠️ Nenhuma thumbnail disponível para processar')
          }
        } catch (error) {
          console.error('❌ Erro ao processar thumbnail para base64:', error)
          toast('Não foi possível usar a thumbnail para análise. Preencha os campos manualmente.', { icon: '⚠️' })
        }
      }
      
      // Chamar API de IA com timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 28000) // 28 segundos timeout
      
      // Combinar sinais: se a análise foi cancelada, cancelar também a chamada da API
      const combinedSignal = signal.aborted ? signal : controller.signal
      
      let aiResponse
      try {
        console.log('📤 Enviando requisição para API de IA:', {
          fileName: file.name,
          fileType: file.type,
          hasImageBase64: !!imageBase64,
          imageBase64Length: imageBase64?.length || 0,
          imageBase64Preview: imageBase64 ? imageBase64.substring(0, 50) + '...' : 'none',
          hasMetadata: !!metadata,
          categoriesCount: categories.length
        })
        
        aiResponse = await fetch('/api/ai/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata,
            fileName: file.name,
            categories: categories.length > 0 ? categories : undefined,
            imageBase64: imageBase64
          }),
          signal: combinedSignal
        })
        
        if (!aiResponse.ok) {
          throw new Error('Erro ao gerar conteúdo com IA')
        }
      } catch (error: any) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError' || signal.aborted) {
          if (signal.aborted) {
            console.log('🛑 Análise pela IA cancelada pelo usuário')
            return // Não mostrar erro se foi cancelado pelo usuário
          }
          console.warn('⏱️ Timeout na análise pela IA, usando valores padrão')
          // Usar valores padrão baseados no nome do arquivo
          const autoTitle = extractTitleFromFilename(file.name)
          if (autoTitle) {
            setFormData(prev => ({ ...prev, title: autoTitle }))
          }
          toast.error('Análise pela IA demorou muito. Preencha os campos manualmente.')
          return
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
      
      const aiData = await aiResponse.json()
      
      // Preencher campos automaticamente com animação sequencial
      if (aiData.title) {
        // Pequeno delay para animação
        setTimeout(() => {
          setFormData(prev => ({ ...prev, title: aiData.title }))
        }, 100)
      }
      
      // Descrição não é mais gerada pela IA, usamos descrições padrão
      
      if (aiData.keywords && aiData.keywords.length > 0) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, keywords: aiData.keywords.join(', ') }))
        }, 300)
      }
      
      // Selecionar categoria sugerida
      if (aiData.category_id || (aiData.category_ids && aiData.category_ids.length > 0)) {
        const categoryId = aiData.category_id || aiData.category_ids[0]
        setTimeout(() => {
          setFormData(prev => ({ ...prev, category_id: categoryId }))
        }, 400)
      }
      
      // Aguardar um pouco antes de mostrar o toast para dar tempo das animações
      setTimeout(() => {
        toast.success('✨ Conteúdo gerado automaticamente com IA!', {
          duration: 3000
        })
      }, 500)
      
      clearTimeout(overallTimeout)
    } catch (error: any) {
      clearTimeout(overallTimeout)
      
      // Se foi cancelado pelo usuário, não mostrar erro
      if (error.name === 'AbortError' && signal.aborted) {
        return
      }
      
      console.error('Erro ao gerar conteúdo com IA:', error)
      setAiError(error.message || 'Erro ao processar com IA')
      
      // Se for timeout, usar valores padrão
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        const autoTitle = extractTitleFromFilename(file.name)
        if (autoTitle) {
          setFormData(prev => ({ ...prev, title: autoTitle }))
        }
        toast.error('Análise pela IA demorou muito. Preencha os campos manualmente.')
      } else {
        toast.error('Não foi possível gerar conteúdo automaticamente. Preencha manualmente.')
      }
    } finally {
      clearTimeout(overallTimeout)
      setIsAiProcessing(false)
      aiAbortControllerRef.current = null
    }
  }

  // PASSO 2: Upload da thumbnail - AQUI é onde a IA deve ser chamada
  async function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedThumbnail = e.target.files?.[0]
    if (!selectedThumbnail) {
      setThumbnail(null)
      setThumbnailPreview(null)
      return
    }

    if (!file) {
      toast.error('Selecione primeiro o arquivo principal')
      return
    }

    console.log('📸 PASSO 2: Thumbnail selecionada:', selectedThumbnail.name)
    setThumbnail(selectedThumbnail)
    
    // Criar preview da thumbnail
    const reader = new FileReader()
    reader.onloadend = async () => {
      const thumbnailBase64 = reader.result as string
      setThumbnailPreview(thumbnailBase64)
      
      // Se não for imagem/vídeo, usar thumbnail como preview
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setPreview(thumbnailBase64)
      }
      
      console.log('✅ Thumbnail processada, tamanho base64:', thumbnailBase64.length)
      
      // Aguardar um pouco para garantir que o estado foi atualizado
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // PASSO 3: Gerar conteúdo com IA usando a thumbnail (AQUI é onde chama a IA!)
      if (!isAiProcessing) {
        console.log('🤖 PASSO 3: Iniciando análise pela IA com thumbnail...')
        generateContentWithAI(file, thumbnailBase64)
      }
    }
    reader.readAsDataURL(selectedThumbnail)
  }

  // PASSO 1: Upload do arquivo principal
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    console.log('📤 PASSO 1: Arquivo selecionado:', selectedFile.name, selectedFile.type)
    
    // Limpar estados anteriores
      setFile(selectedFile)
    setThumbnail(null)
    setThumbnailPreview(null)
    setPreview(null)
    setVideoPreview(null)
    setFormData(prev => ({ ...prev, title: '', keywords: '', category_id: '' }))
    
    // PASSO 1.1: Detectar tipo automaticamente
    let detectedType: ResourceType = 'image'
    if (selectedFile.type.startsWith('video/')) {
      detectedType = 'video'
    } else if (selectedFile.type === 'image/png' || selectedFile.name.toLowerCase().endsWith('.png')) {
      detectedType = 'png'
    } else if (selectedFile.type.includes('psd') || selectedFile.name.toLowerCase().endsWith('.psd')) {
      detectedType = 'psd'
    } else if (selectedFile.type.includes('ai') || selectedFile.name.toLowerCase().endsWith('.ai') || selectedFile.name.toLowerCase().endsWith('.eps')) {
      detectedType = 'ai'
    } else if (selectedFile.type.includes('font') || selectedFile.name.toLowerCase().match(/\.(ttf|otf|woff|woff2)$/)) {
      detectedType = 'font'
    } else if (selectedFile.type.startsWith('audio/')) {
      detectedType = 'audio'
    }
    
    console.log('🔍 Tipo detectado:', detectedType)
    
    // Atualizar tipo no formulário
    setFormData(prev => ({ ...prev, resource_type: detectedType }))
    
    // Carregar categorias para o tipo detectado
    await loadCategoriesForType(detectedType)
    
    // PASSO 1.2: Criar preview conforme o tipo (SEM chamar IA ainda)
      if (selectedFile.type.startsWith('image/')) {
      // IMAGEM: Criar preview (a própria imagem será usada como thumbnail)
        const reader = new FileReader()
        reader.onloadend = () => {
        const base64 = reader.result as string
        setPreview(base64)
          setVideoPreview(null)
        // Para imagens, a própria imagem é a thumbnail, mas NÃO chamar IA ainda
        // A IA será chamada quando o usuário "confirmar" ou automaticamente após um momento
        console.log('✅ Imagem carregada. Aguardando confirmação para análise pela IA...')
        }
        reader.readAsDataURL(selectedFile)
      } else if (selectedFile.type.startsWith('video/')) {
      // VÍDEO: Criar preview (thumbnail será gerada automaticamente no upload)
        const videoUrl = URL.createObjectURL(selectedFile)
        setVideoPreview(videoUrl)
        setPreview(null)
        
      // Inicializar videoMetadata
        if (!videoMetadata) {
          setVideoMetadata({})
        }
        
        // Extrair metadados do vídeo
        extractVideoMetadata(selectedFile).then(metadata => {
          if (metadata) {
            setVideoMetadata(prev => ({ ...prev, ...metadata }))
          }
        })
        
      console.log('✅ Vídeo carregado. Faça upload de uma thumbnail para análise pela IA.')
      } else {
      // OUTROS TIPOS (PSD, AI, EPS, etc.): Aguardar upload de thumbnail
      console.log('⏳ PASSO 2: Arquivo não é imagem/vídeo. Aguardando upload de thumbnail...')
        setPreview(null)
        setVideoPreview(null)
        
      // Auto-detectar título básico do nome do arquivo (temporário)
        const autoTitle = extractTitleFromFilename(selectedFile.name)
      if (autoTitle) {
          setFormData(prev => ({ ...prev, title: autoTitle }))
        }
      }
    
    // Mensagem informativa para TODOS os tipos
    toast('📸 Faça upload de uma thumbnail no PASSO 2. A IA analisará a thumbnail para gerar os dados automaticamente.', { 
      icon: '📸',
      duration: 5000
    })
  }


  return (
    <div className="max-w-5xl mx-auto px-4 md:px-0">
      <div className="flex flex-col space-y-2 mb-10">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Novo Upload</h1>
        <p className="text-gray-400 font-medium text-sm tracking-wider">Envie seus arquivos para a comunidade BrasilPSD.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        <div className="space-y-8">
          {/* PASSO 1: Upload do Arquivo Principal */}
          <Card className="border-none p-8">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter mb-8 flex items-center">
              <span className="h-6 w-1 bg-gray-900 mr-3 rounded-full" />
              PASSO 1: Arquivo Principal
              {file && (
                <span className="ml-3 px-3 py-1 bg-primary-100 text-primary-700 text-sm font-bold rounded-full">
                  ✓ Arquivo selecionado
                </span>
              )}
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-base font-semibold text-gray-600 tracking-widest mb-4 uppercase">
                  PASSO 1: Selecione o arquivo principal
                  {file && (
                    <span className="ml-2 text-primary-600 font-bold normal-case text-sm">
                      ✓ Arquivo selecionado
                    </span>
                  )}
                  {isAiProcessing && (
                    <span className="ml-2 text-gray-700 text-sm">(IA analisando...)</span>
                  )}
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileChange}
                    accept="image/*,video/*,.psd,.ai,.eps,.zip,.rar,.7z,.ttf,.otf,.woff,.woff2,audio/*"
                    required
                  />
                  <div className={`h-48 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center relative overflow-hidden ${
                    isAiProcessing 
                      ? 'border-gray-900 bg-gray-50/50 animate-pulse' 
                      : file 
                      ? 'border-gray-900 bg-gray-50/30' 
                        : 'border-gray-200 group-hover:border-gray-900 group-hover:bg-gray-50/30'
                  }`}>
                    {/* Animação de ondas durante processamento da IA */}
                    {isAiProcessing && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/30 to-transparent animate-[shimmer_2s_infinite]"></div>
                      </div>
                    )}
                    
                    <div className="relative z-10 flex flex-col items-center">
                      {isAiProcessing ? (
                        <>
                          <div className="relative mb-3">
                            <Sparkles className="h-10 w-10 text-gray-900 animate-pulse" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-6 w-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          </div>
                          <p className="text-base font-bold text-gray-900 mb-1 animate-pulse">
                            Analisando com IA...
                          </p>
                          <p className="text-sm font-medium text-gray-600 mb-3">
                            Gerando título e categoria
                          </p>
                          <button
                            type="button"
                            onClick={cancelAiAnalysis}
                            className="px-4 py-2 text-base font-semibold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors"
                          >
                            Cancelar Análise
                          </button>
                        </>
                      ) : file ? (
                        <>
                          <div className="mb-3 relative">
                            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                              <UploadIcon className="h-6 w-6 text-gray-900" />
                            </div>
                            {thumbnail && (
                              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gray-900 flex items-center justify-center border-2 border-white shadow-sm">
                                <ImageIcon className="h-3 w-3 text-white" />
                              </div>
                            )}
                            {isUploading && (
                              <div className="absolute -top-1 -right-1 h-4 w-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                            )}
                          </div>
                          <p className="text-sm font-bold text-gray-900 mb-1 truncate max-w-full px-4">
                            {file.name}
                          </p>
                          {thumbnail && (
                            <p className="text-sm text-gray-700 font-medium mt-1 truncate max-w-full px-4">
                              + {thumbnail.name}
                            </p>
                          )}
                          <p className="text-sm font-medium text-gray-400">
                            {formatBytes(file.size)}
                          </p>
                          {isUploading && (
                            <div className="mt-2 w-full max-w-xs">
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gray-900 rounded-full transition-all duration-300 ease-out"
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                              <p className="text-sm text-gray-500 mt-1 text-center">
                                {uploadProgress}% {uploadPhase === 'uploading' ? 'enviado' : 'processado'}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <UploadIcon className="h-10 w-10 text-gray-300 group-hover:text-gray-900 mb-3 transition-colors" />
                          <p className="text-base font-semibold text-gray-600 tracking-widest uppercase group-hover:text-gray-900">
                            Clique ou arraste o arquivo aqui
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {(preview || videoPreview || (file && !file.type.startsWith('image/') && !file.type.startsWith('video/'))) && (
                  <div className="mt-6 rounded-3xl overflow-hidden border border-gray-100 shadow-sm animate-[fadeIn_0.5s_ease-in]">
                    <p className="p-4 bg-gray-50 text-sm font-semibold text-gray-400 tracking-widest border-b border-gray-100 uppercase">Pré-visualização</p>
                    {preview ? (
                      <div className={`w-full flex items-center justify-center ${file?.type === 'image/png' || file?.name?.toLowerCase().endsWith('.png') ? 'bg-checkerboard' : 'bg-white'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={preview} 
                          alt="Preview" 
                          className="w-full h-auto max-h-[400px] object-contain mx-auto animate-[fadeIn_0.6s_ease-in]" 
                        />
                      </div>
                    ) : videoPreview ? (
                      <div className="relative w-full bg-black group">
                        <video
                          src={videoPreview}
                          className="w-full h-auto max-h-[400px] object-contain mx-auto"
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => {
                            e.currentTarget.play()
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause()
                            e.currentTarget.currentTime = 0
                          }}
                        />
                        {videoMetadata && (
                          <div className="absolute bottom-4 left-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-lg backdrop-blur-sm space-y-1">
                            <div>
                              {videoMetadata.width} × {videoMetadata.height}
                              {videoMetadata.duration && (
                                <span className="ml-2">
                                  • {Math.round(videoMetadata.duration)}s
                                </span>
                              )}
                            </div>
                            {videoMetadata.frameRate && (
                              <div className="text-sm opacity-90">
                                {videoMetadata.frameRate.toFixed(2)} fps
                                {videoMetadata.encoding && ` • ${videoMetadata.encoding}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : file && !file.type.startsWith('image/') && !file.type.startsWith('video/') ? (
                      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-gray-50 to-gray-100">
                        <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                          <UploadIcon className="h-10 w-10 text-gray-900" />
                        </div>
                        <p className="text-sm font-bold text-gray-900 mb-2">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500 text-center mb-4 max-w-xs">
                          {file.type.includes('psd') || file.name.toLowerCase().endsWith('.psd')
                            ? 'Arquivo PSD - Faça upload de uma thumbnail para visualizar'
                            : file.type.includes('ai') || file.name.toLowerCase().endsWith('.ai') || file.name.toLowerCase().endsWith('.eps')
                            ? file.name.toLowerCase().endsWith('.eps') 
                              ? 'Arquivo EPS (Illustrator) - Faça upload de uma thumbnail para visualizar'
                              : 'Arquivo Adobe Illustrator - Faça upload de uma thumbnail para visualizar'
                            : 'Arquivo não suporta preview direto - Faça upload de uma thumbnail para visualizar'}
                        </p>
                        {!thumbnail && (
                            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                              <p className="text-sm font-semibold text-gray-700 text-center">
                              💡 Dica: Faça upload de uma thumbnail/imagem do conteúdo acima
                            </p>
                          </div>
                        )}
                        {thumbnail && (
                          <div className="px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl mt-2">
                            <p className="text-sm font-semibold text-primary-700 text-center">
                              ✓ Thumbnail selecionada: {thumbnail.name}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* PASSO 2: Thumbnail - Sempre visível, após upload do arquivo */}
          <Card className="border-none p-8" data-thumbnail-section>
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter mb-8 flex items-center">
              <span className="h-6 w-1 bg-gray-900 mr-3 rounded-full" />
              PASSO 2: Thumbnail
              {file && !file.type.startsWith('image/') && !file.type.startsWith('video/') ? (
                <>
                  <span className="text-red-500 ml-1">*</span>
                  <span className="ml-3 px-3 py-1 bg-red-100 text-red-700 text-sm font-bold rounded-full flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Obrigatória para análise pela IA
                  </span>
                </>
              ) : file ? (
                    <span className="ml-3 px-3 py-1 bg-gray-100 text-gray-700 text-sm font-bold rounded-full flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      Faça upload para IA gerar dados
                    </span>
              ) : null}
            </h2>
              
              <div>
                <label className="block text-base font-semibold text-gray-600 tracking-widest mb-4 uppercase">
                  {file && !file.type.startsWith('image/') && !file.type.startsWith('video/') ? (
                    <>
                      Faça upload da thumbnail (OBRIGATÓRIA)
                      {thumbnail && (
                        <span className="ml-2 text-primary-600 font-bold normal-case text-sm">
                          ✓ Thumbnail selecionada - IA analisando...
                        </span>
                      )}
                      <span className="ml-2 text-red-500 font-bold normal-case text-sm block mt-1">
                        A IA analisará esta imagem para gerar título e categoria
                      </span>
                    </>
                  ) : (
                    <>
                      Faça upload da thumbnail
                      {thumbnail && (
                        <span className="ml-2 text-primary-600 font-bold normal-case text-sm">
                          ✓ Thumbnail selecionada - IA analisando...
                        </span>
                      )}
                        <span className="ml-2 text-gray-700 font-bold normal-case text-sm block mt-1">
                          A IA analisará esta imagem para gerar título e categoria automaticamente
                        </span>
                    </>
                  )}
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    disabled={!file || isAiProcessing}
                  />
                  <div className={`h-40 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center ${
                    !file
                      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                      : file && !file.type.startsWith('image/') && !file.type.startsWith('video/') && !thumbnail
                      ? 'border-red-300 bg-red-50/50 group-hover:border-red-500 group-hover:bg-red-50/70 animate-pulse'
                      : file && !file.type.startsWith('image/') && !file.type.startsWith('video/') && thumbnail
                      ? 'border-primary-300 bg-primary-50/30 group-hover:border-primary-500'
                        : 'border-gray-200 group-hover:border-gray-900 group-hover:bg-gray-50/30'
                  }`}>
                    {thumbnailPreview ? (
                      <>
                        <div className={`w-full h-full flex items-center justify-center ${thumbnail?.type === 'image/png' || thumbnail?.name?.toLowerCase().endsWith('.png') ? 'bg-checkerboard' : ''}`}>
                          <img 
                            src={thumbnailPreview} 
                            alt="Thumbnail preview" 
                            className="max-h-32 max-w-full rounded-xl mb-2 object-contain"
                          />
                        </div>
                        <p className="text-sm font-semibold text-gray-600 truncate max-w-full px-4">
                          {thumbnail?.name}
                        </p>
                        {file && !file.type.startsWith('image/') && !file.type.startsWith('video/') && (
                            <p className="text-sm text-gray-700 font-medium mt-1">
                              ✓ Será usada para análise pela IA
                            </p>
                        )}
                      </>
                    ) : (
                      <>
                        <ImageIcon className={`h-8 w-8 mb-2 transition-colors ${
                          file && !file.type.startsWith('image/') && !file.type.startsWith('video/')
                            ? 'text-red-500'
                              : 'text-gray-300 group-hover:text-gray-900'
                        }`} />
                        <p className={`text-sm font-semibold tracking-widest uppercase truncate max-w-full px-4 ${
                          file && !file.type.startsWith('image/') && !file.type.startsWith('video/')
                            ? 'text-red-600'
                              : 'text-gray-400 group-hover:text-gray-900'
                        }`}>
                          {!file
                            ? 'Selecione o arquivo principal primeiro'
                            : isAiProcessing
                            ? 'IA analisando thumbnail...'
                            : file && !file.type.startsWith('image/') && !file.type.startsWith('video/')
                            ? 'Selecionar Thumbnail (OBRIGATÓRIA)'
                            : 'Selecionar Thumbnail para análise pela IA'}
                        </p>
                        {file && !file.type.startsWith('image/') && !file.type.startsWith('video/') && (
                          <p className="text-sm text-red-600 font-bold mt-1">
                            ⚠️ Obrigatória: A IA analisará esta imagem para gerar conteúdo
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>

          {/* PASSO 3: Informações do Arquivo */}
          <Card className="border-none p-8">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter mb-8 flex items-center">
              <span className="h-6 w-1 bg-gray-900 mr-3 rounded-full" />
              PASSO 3: Informações do Arquivo
              {isAiProcessing && (
                <span className="ml-3 px-3 py-1 bg-gray-100 text-gray-700 text-sm font-bold rounded-full flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  IA Gerando...
                </span>
              )}
            </h2>
            
            <div className="space-y-6">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-400 tracking-widest uppercase">
                    Título do Arquivo
                  </label>
                  {isAiProcessing && (
                      <div className="flex items-center gap-2 text-sm text-gray-700 animate-pulse">
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        <span className="font-medium">IA gerando...</span>
                      </div>
                  )}
                </div>
                <div className="relative">
                  {isAiProcessing && !formData.title && (
                    <div className="absolute inset-0 bg-gray-50 rounded-2xl animate-pulse">
                      <div className="h-full bg-gradient-to-r from-transparent via-gray-100 to-transparent animate-[shimmer_1.5s_infinite]"></div>
                    </div>
                  )}
                  <input
                    type="text"
                placeholder="Ex: Mockup de Camiseta Minimalista"
                      className={`flex h-14 w-full rounded-2xl border px-5 py-2 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all relative z-10 ${
                        isAiProcessing && !formData.title 
                          ? 'border-gray-300 bg-gray-50/30' 
                          : formData.title && isAiProcessing
                          ? 'border-gray-900 bg-gray-50/20 animate-[fadeIn_0.5s_ease-in]'
                          : 'border-gray-100 bg-gray-50/50'
                      }`}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
                </div>
                {aiError && (
                  <p className="mt-1 text-sm text-red-500 animate-[fadeIn_0.3s_ease-in]">{aiError}</p>
                )}
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                    Tipo de Arquivo
                  </label>
                  <select
                        className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-base font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all appearance-none"
                    value={formData.resource_type}
                    onChange={async (e) => {
                      const newType = e.target.value as ResourceType
                      setFormData({ ...formData, resource_type: newType, category_id: '' }) // Limpar categoria ao mudar tipo
                      // Carregar categorias apropriadas para o novo tipo
                      await loadCategoriesForType(newType)
                      // Inicializar videoMetadata se mudar para vídeo
                      if (newType === 'video' && !videoMetadata) {
                        setVideoMetadata({})
                      }
                    }}
                    required
                  >
                    <option value="image">Imagem</option>
                    <option value="png">PNG</option>
                    <option value="video">Vídeo</option>
                    <option value="font">Fonte</option>
                    <option value="psd">PSD</option>
                    <option value="ai">AI / EPS</option>
                    <option value="audio">Áudio</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-400 uppercase tracking-tight">
                    Categoria
                      {isAiProcessing && (
                        <span className="ml-2 text-primary-500 text-sm animate-pulse">
                          <Sparkles className="h-2.5 w-2.5 inline mr-1" />
                          IA sugerindo...
                        </span>
                      )}
                  </label>
                    {file && !isAiProcessing && (
                      <button
                        type="button"
                        onClick={() => {
                          if (file) {
                            const base64 = preview || undefined
                            generateContentWithAI(file, base64)
                          }
                        }}
                          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Regenerar com IA</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    {isAiProcessing && !formData.category_id && (
                      <div className="absolute inset-0 bg-gray-50 rounded-2xl animate-pulse z-0">
                        <div className="h-full bg-gradient-to-r from-transparent via-gray-100 to-transparent animate-[shimmer_1.5s_infinite]"></div>
                      </div>
                    )}
                  <select
                      className={`flex h-14 w-full rounded-2xl border px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all appearance-none relative z-10 ${
                          isAiProcessing && !formData.category_id 
                            ? 'border-gray-300 bg-gray-50/30' 
                            : formData.category_id && isAiProcessing
                            ? 'border-gray-900 bg-gray-50/20 animate-[fadeIn_0.5s_ease-in]'
                            : 'border-gray-100 bg-gray-50/50'
                        }`}
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    <option value="">Selecionar Categoria</option>
                    {categories
                      .filter(cat => !cat.parent_id)
                      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                      .map((parent) => (
                        <optgroup key={parent.id} label={parent.name}>
                          <option value={parent.id}>{parent.name} (Tudo)</option>
                          {categories
                            .filter(sub => sub.parent_id === parent.id)
                            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
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
              </div>

              {/* Configurações de Vídeo */}
              {formData.resource_type === 'video' && (
                <div className="space-y-4 p-5 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                    Configurações do Vídeo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Largura (px)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                        value={videoMetadata?.width || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, width: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="1920"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Altura (px)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                        value={videoMetadata?.height || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, height: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="1080"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Duração (segundos)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                        value={videoMetadata?.duration || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="60"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Frame Rate (fps)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                        value={videoMetadata?.frameRate || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, frameRate: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="30"
                        min="1"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Codec / Codificação
                      </label>
                      <input
                        type="text"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                        value={videoMetadata?.codec || videoMetadata?.encoding || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, codec: e.target.value || undefined, encoding: e.target.value || undefined }))}
                        placeholder="Ex: Apple ProRes 422, H.264"
                      />
                      {videoMetadata?.codecName && videoMetadata.codecName !== videoMetadata.codec && (
                        <p className="text-sm text-gray-400 mt-1">Detectado: {videoMetadata.codecName}</p>
                      )}
                    </div>
                    {videoMetadata?.colorSpace && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                          Espaço de Cor
                        </label>
                        <input
                          type="text"
                          className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                          value={videoMetadata.colorSpace || ''}
                          onChange={(e) => setVideoMetadata(prev => ({ ...prev, colorSpace: e.target.value || undefined }))}
                          placeholder="Ex: bt709, smpte170m"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Orientação
                      </label>
                      <select
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40 transition-all"
                        value={videoMetadata?.orientation || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, orientation: e.target.value || undefined }))}
                      >
                        <option value="">Selecionar...</option>
                        <option value="Horizontal">Horizontal</option>
                        <option value="Vertical">Vertical</option>
                        <option value="Quadrado">Quadrado</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                          className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        checked={videoMetadata?.hasAlpha || false}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, hasAlpha: e.target.checked }))}
                      />
                      <span className="text-sm font-semibold text-gray-700">Canal Alfa (Transparência)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                          className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        checked={videoMetadata?.hasLoop || false}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, hasLoop: e.target.checked }))}
                      />
                      <span className="text-sm font-semibold text-gray-700">Com Loop</span>
                    </label>
                  </div>
                  {videoMetadata && (videoMetadata.width || videoMetadata.height) && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                      <p className="text-sm font-semibold text-gray-700">
                        Resolução: {videoMetadata.width} × {videoMetadata.height}
                        {videoMetadata.duration && ` • ${Math.round(videoMetadata.duration)}s`}
                        {videoMetadata.frameRate && ` • ${videoMetadata.frameRate.toFixed(2)} fps`}
                      </p>
                      {videoMetadata.codec && (
                        <p className="text-sm text-gray-600">
                          Codec: {videoMetadata.codec}
                          {videoMetadata.audioCodec && ` • Áudio: ${videoMetadata.audioCodec.toUpperCase()}`}
                        </p>
                      )}
                      {videoMetadata.colorSpace && (
                        <p className="text-sm text-gray-600">
                          Espaço de Cor: {videoMetadata.colorSpace}
                          {videoMetadata.hasTimecode && ` • Com Timecode`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                  Tags (Vírgulas)
                  {isAiProcessing && (
                    <span className="ml-2 text-primary-500 text-sm animate-pulse">
                      <Sparkles className="h-2.5 w-2.5 inline mr-1" />
                      IA sugerindo...
                    </span>
                  )}
                </label>
                <div className="relative">
                  {isAiProcessing && !formData.keywords && (
                    <div className="absolute inset-0 bg-gray-50 rounded-2xl animate-pulse z-0">
                      <div className="h-full bg-gradient-to-r from-transparent via-gray-100 to-transparent animate-[shimmer_1.5s_infinite]"></div>
                    </div>
                  )}
                  <input
                    type="text"
                placeholder="moderno, psd, tech"
                    className={`flex h-14 w-full rounded-2xl border px-5 py-2 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all relative z-10 ${
                        isAiProcessing && !formData.keywords 
                          ? 'border-gray-300 bg-gray-50/30' 
                          : formData.keywords && isAiProcessing
                          ? 'border-gray-900 bg-gray-50/20 animate-[fadeIn_0.5s_ease-in]'
                          : 'border-gray-100 bg-gray-50/50'
                      }`}
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              />
                </div>
              </div>

              {/* Campo de Coleção */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                  Coleção (Opcional)
                </label>
                <div className="space-y-3">
                  {!showNewCollectionForm ? (
                    <>
                      {newCollectionTitle.trim() && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl mb-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Nova coleção será criada:</p>
                          <p className="text-sm font-bold text-gray-900">{newCollectionTitle}</p>
                          <button
                            type="button"
                          onClick={() => {
                            setNewCollectionTitle('')
                            // Quando remover a nova coleção, manter o is_premium atual
                            setFormData({ ...formData, collection_id: '' })
                          }}
                            className="mt-2 text-sm text-gray-700 hover:text-gray-900 underline"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                      <select
                        className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-base font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900/20 transition-all appearance-none"
                        value={formData.collection_id}
                        onChange={(e) => {
                          const selectedCollectionId = e.target.value
                          const selectedCollection = collections.find(c => c.id === selectedCollectionId)
                          
                          // Se selecionar uma coleção premium, marcar is_premium automaticamente
                          // Se selecionar uma coleção não premium, manter true se is_official estiver marcado, senão manter valor atual
                          const newIsPremium = selectedCollection?.is_premium 
                            ? true 
                            : (formData.is_official ? true : formData.is_premium)
                          
                          setFormData({ 
                            ...formData, 
                            collection_id: selectedCollectionId,
                            is_premium: newIsPremium
                          })
                          
                          // Limpar título da nova coleção se selecionar uma existente
                          if (selectedCollectionId) {
                            setNewCollectionTitle('')
                            setShowNewCollectionForm(false)
                          }
                        }}
                        disabled={!!newCollectionTitle.trim()}
                      >
                        <option value="">Nenhuma coleção</option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.title}
                          </option>
                        ))}
                      </select>
                      {!newCollectionTitle.trim() && (
                        <button
                          type="button"
                          onClick={() => setShowNewCollectionForm(true)}
                          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Criar nova coleção
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3 p-4 bg-gray-50/30 rounded-2xl border border-gray-100">
                      <Input
                        label="Título da Nova Coleção"
                        placeholder="Ex: Templates de Social Media"
                        value={newCollectionTitle}
                        onChange={(e) => setNewCollectionTitle(e.target.value)}
                      />
                      <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCollectionForm(false)
                          setNewCollectionTitle('')
                          setFormData({ ...formData, collection_id: '' })
                        }}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCollectionTitle.trim()) {
                            toast.error('Digite um título para a coleção')
                            return
                          }
                          setShowNewCollectionForm(false)
                          // Manter o título para criar no submit
                        }}
                        className="flex-1 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold transition-colors"
                      >
                        Confirmar
                      </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className={`flex items-center space-x-8 p-6 rounded-3xl border shadow-sm ${
                  isPremiumLocked 
                      ? 'bg-gray-50/30 border-gray-200' 
                    : 'bg-gray-50 border-gray-100'
                }`}>
                  <label className={`flex items-center ${isPremiumLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} group`}>
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.is_premium}
                        disabled={isPremiumLocked}
                        onChange={(e) => !isPremiumLocked && setFormData({ ...formData, is_premium: e.target.checked })}
                      />
                        <div className={`block w-14 h-8 rounded-full transition-all ${formData.is_premium ? 'bg-gray-900' : 'bg-gray-300'} ${isPremiumLocked ? 'opacity-75' : ''}`} />
                      <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all transform ${formData.is_premium ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <div className="ml-4 flex flex-col">
                      <span className="text-sm font-semibold text-gray-700 tracking-tighter uppercase">
                        Este recurso é Premium
                        {isPremiumCollection && (
                            <span className="ml-2 text-gray-700 text-sm font-normal">
                            (Definido pela coleção)
                          </span>
                        )}
                        {isOfficial && (
                            <span className="ml-2 text-gray-700 text-sm font-normal">
                            (Definido por ser oficial)
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-gray-400 font-medium tracking-tight">
                        {isPremiumCollection 
                          ? 'A coleção selecionada é premium, este arquivo também será premium'
                          : isOfficial
                          ? 'Arquivos oficiais do sistema são automaticamente premium'
                          : 'Disponível apenas para assinantes do site'
                        }
                      </span>
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
                        onChange={(e) => {
                          const newIsOfficial = e.target.checked
                          const selectedCollection = collections.find(c => c.id === formData.collection_id)
                          const collectionIsPremium = selectedCollection?.is_premium || false
                          
                          setFormData({ 
                            ...formData, 
                            is_official: newIsOfficial,
                            // Se marcar como oficial, também marcar como premium automaticamente
                            // Se desmarcar, manter true se a coleção for premium, senão deixar o usuário escolher
                            is_premium: newIsOfficial ? true : (collectionIsPremium ? true : formData.is_premium)
                          })
                        }}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-all ${formData.is_official ? 'bg-gray-900' : 'bg-gray-700'}`} />
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all transform ${formData.is_official ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                      <div className="ml-4 flex flex-col">
                        <span className="text-sm font-bold text-white tracking-tighter uppercase flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-gray-900" />
                          Arquivo Oficial BrasilPSD
                        </span>
                        <span className="text-sm text-gray-500 font-medium">O sistema aparecerá como autor oficial (será premium automaticamente)</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </Card>
              </div>

          {/* PASSO 4: Finalizar e Enviar - Movido para o final */}
          <div className="flex flex-col space-y-3 pt-8 border-t border-gray-200">
            {isUploading && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg space-y-4 animate-[fadeIn_0.3s_ease-in] relative overflow-hidden">
                {/* Animação de fundo durante upload */}
                {uploadPhase === 'uploading' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-50/20 to-transparent animate-[shimmer_2s_infinite] pointer-events-none"></div>
                )}
                
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-2">
                    {uploadPhase === 'uploading' ? (
                      <UploadIcon className="h-4 w-4 text-gray-900 animate-bounce" />
                    ) : (
                      <div className="h-4 w-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                    {uploadPhase === 'uploading' ? 'Enviando arquivos...' : 'Processando mídia...'}
                  </span>
                </div>
                  <span className="text-sm font-black text-gray-900 animate-pulse">{uploadProgress}%</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden relative z-10">
                  <div 
                    className="h-full bg-gradient-to-r from-gray-900 to-black transition-all duration-300 ease-out shadow-sm relative overflow-hidden"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {/* Efeito de brilho na barra de progresso */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]"></div>
                  </div>
                </div>
                {uploadPhase === 'uploading' && uploadStats.totalBytes > 0 && (
                  <div className="space-y-3 pt-2">
                    {/* Informações principais em destaque */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-1">Enviado</div>
                        <div className="text-base font-black text-gray-900">
                          {formatBytes(uploadStats.bytesUploaded)} <span className="text-sm font-semibold text-gray-600">/ {formatBytes(uploadStats.totalBytes)}</span>
                        </div>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-1">Velocidade</div>
                        <div className="text-base font-black text-gray-900">{formatSpeed(uploadStats.speed)}</div>
                      </div>
                    </div>
                    
                    {/* Informações secundárias */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tempo decorrido</span>
                          <span className="text-sm font-bold text-gray-700">{formatTime(uploadStats.elapsedTime)}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tempo restante</span>
                          <span className="text-sm font-bold text-gray-700">
                            {uploadStats.speed > 0 && uploadStats.remainingTime > 0 
                              ? formatTime(uploadStats.remainingTime) 
                              : 'Calculando...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {uploadPhase === 'processing' && (
                  <div className="pt-2 space-y-2 relative z-10">
                    <div className="flex justify-between items-center animate-[fadeIn_0.3s_ease-in]">
                      <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Arquivo enviado</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatBytes(uploadStats.totalBytes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center animate-[fadeIn_0.3s_ease-in]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-gray-900 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Processando no servidor</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-gray-900">Em andamento...</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tempo total</span>
                      <span className="text-sm font-bold text-gray-700">
                        {formatTime((Date.now() - uploadStats.startTime) / 1000)}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-gray-400 font-medium text-center italic pt-2">
                  {uploadPhase === 'processing' ? 'Processando e otimizando arquivo no servidor...' : 'Não feche esta página.'}
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isUploading || (file && !file.type.startsWith('image/') && !file.type.startsWith('video/') && !thumbnail)}
              className="w-full py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm tracking-widest transition-all disabled:opacity-50 uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {isUploading ? (
                uploadPhase === 'processing' ? 'Finalizando...' : 'Enviando...'
              ) : (
                <span>
                  PASSO 4: Finalizar e Enviar
                  {file && !file.type.startsWith('image/') && !file.type.startsWith('video/') && !thumbnail && (
                    <span className="block text-sm text-red-300 mt-1 font-normal normal-case">
                      (Complete o PASSO 2 primeiro)
                    </span>
                  )}
                </span>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isUploading}
              className="w-full py-4 text-gray-400 hover:text-gray-600 font-semibold text-sm tracking-[0.2em] transition-all uppercase disabled:opacity-30"
            >
              Cancelar Envio
            </button>
        </div>
      </form>
    </div>
  )
}

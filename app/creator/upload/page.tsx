'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Image as ImageIcon, Info, ShieldCheck, FolderPlus, Plus } from 'lucide-react'
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
    description: '',
    resource_type: 'image' as ResourceType,
    category_id: '',
    keywords: '',
    is_premium: false,
    is_official: false,
    collection_id: '',
  })

  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
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
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Função para carregar categorias baseado no tipo de recurso
  async function loadCategoriesForType(resourceType: ResourceType) {
    if (resourceType === 'image') {
    } else {
      // Para outros tipos, buscar todas as categorias
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .order('name')
      
      setCategories(cats || [])
    }
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

        // Carregar categorias baseado no tipo inicial (image)
        await loadCategoriesForType('image')

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
          // Upload direto concluído, agora processar no servidor
          setUploadPhase('processing')
          setUploadProgress(96)
          
          // Notificar servidor para processar o arquivo
          fetch('/api/upload/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key,
              url,
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
              type: type
            })
          })
            .then(async res => {
              if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Erro ao processar arquivo')
              }
              return res.json()
            })
            .then(data => {
              setUploadProgress(100)
              resolve({ ...data, url, key })
            })
            .catch(err => {
              console.error('Processing error:', err)
              // Mesmo se processar falhar, o arquivo foi enviado
              // Retornar dados básicos para permitir continuar
              resolve({ 
                url, 
                key, 
                previewUrl: null, 
                thumbnailUrl: null, 
                videoMetadata: null,
                isAiGenerated: false
              })
            })
        } else {
          reject(new Error(`Erro ${xhr.status} no upload`))
        }
      }

      xhr.onerror = () => reject(new Error('Erro de conexão'))
      xhr.ontimeout = () => reject(new Error('Tempo de upload excedido'))

      xhr.timeout = 1800000 // 30 minutos para arquivos grandes
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  function uploadWithProgress(file: File, type: 'resource' | 'thumbnail'): Promise<any> {
    // Para arquivos grandes (>100MB), usar upload direto para S3
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024 // 100MB
    if (file.size > LARGE_FILE_THRESHOLD) {
      console.log('📦 Arquivo grande detectado, usando upload direto para S3')
      return uploadDirectToS3(file, type)
    }

    // Para arquivos menores, usar o fluxo atual (processamento no servidor)
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
              reject(new Error(errorData.error || 'Erro no upload'))
            } catch (err) {
              console.error('Error parsing error response:', err)
              reject(new Error(`Erro ${xhr.status} no servidor`))
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
      
      // Dados básicos do recurso (campos que sempre existem)
      const basicResourceData: any = {
        title: formData.title,
        description: formData.description || null,
        resource_type: formData.resource_type,
        category_id: formData.category_id || null,
        creator_id: creatorId,
        file_url: fileUrl,
        preview_url: previewUrl || null, // Versão com marca d'água para preview
        thumbnail_url: finalThumbnailUrl || null, // Thumbnail extraído automaticamente ou upload manual
        file_size: file.size,
        file_format: file.name.split('.').pop() || '',
        width: videoMetadata?.width ? Number(videoMetadata.width) : null,
        height: videoMetadata?.height ? Number(videoMetadata.height) : null,
        duration: videoMetadata?.duration ? Math.round(Number(videoMetadata.duration)) : null,
        keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        is_premium: formData.is_premium || false,
        is_official: formData.is_official || false,
        is_ai_generated: detectedAi || thumbAiDetected || false,
        status: userProfile?.is_admin ? 'approved' : 'pending',
      }
      
      console.log('💾 Saving resource to database:', {
        title: basicResourceData.title,
        resource_type: basicResourceData.resource_type,
        file_size: basicResourceData.file_size,
        file_url: basicResourceData.file_url?.substring(0, 50) + '...',
        has_video_metadata: !!videoMetadata
      })
      
      // Tentar inserir primeiro sem campos de vídeo extras (caso a migração não tenha sido aplicada)
      let resource, error
      const { data, error: insertError } = await supabase
        .from('resources')
        .insert(basicResourceData)
        .select()
        .single()
      
      resource = data
      error = insertError

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

      // 5. Adicionar à coleção se selecionada
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
      router.push('/creator')
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      
      // Detectar tipo e criar preview
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
          setVideoPreview(null)
        }
        reader.readAsDataURL(selectedFile)
      } else if (selectedFile.type.startsWith('video/')) {
        // Criar preview de vídeo
        const videoUrl = URL.createObjectURL(selectedFile)
        setVideoPreview(videoUrl)
        setPreview(null)
        
        // Inicializar videoMetadata se não existir
        if (!videoMetadata) {
          setVideoMetadata({})
        }
        
        // Inicializar videoMetadata se não existir
        if (!videoMetadata) {
          setVideoMetadata({})
        }
        
        // Extrair metadados do vídeo
        extractVideoMetadata(selectedFile).then(metadata => {
          if (metadata) {
            setVideoMetadata(prev => ({ ...prev, ...metadata }))
          }
        })
        
        // Auto-detectar título do nome do arquivo
        const autoTitle = extractTitleFromFilename(selectedFile.name)
        if (autoTitle && !formData.title) {
          setFormData(prev => ({ ...prev, title: autoTitle }))
        }
        
        // Auto-selecionar tipo de recurso como vídeo
        setFormData(prev => ({ ...prev, resource_type: 'video' }))
      } else {
        setPreview(null)
        setVideoPreview(null)
        
        // Auto-detectar título do nome do arquivo para outros tipos
        const autoTitle = extractTitleFromFilename(selectedFile.name)
        if (autoTitle && !formData.title) {
          setFormData(prev => ({ ...prev, title: autoTitle }))
        }
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

              {/* Configurações de Vídeo */}
              {formData.resource_type === 'video' && (
                <div className="space-y-4 p-5 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
                    Configurações do Vídeo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Largura (px)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
                        value={videoMetadata?.width || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, width: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="1920"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Altura (px)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
                        value={videoMetadata?.height || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, height: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="1080"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Duração (segundos)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
                        value={videoMetadata?.duration || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="60"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Frame Rate (fps)
                      </label>
                      <input
                        type="number"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
                        value={videoMetadata?.frameRate || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, frameRate: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="30"
                        min="1"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Codec / Codificação
                      </label>
                      <input
                        type="text"
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
                        value={videoMetadata?.codec || videoMetadata?.encoding || ''}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, codec: e.target.value || undefined, encoding: e.target.value || undefined }))}
                        placeholder="Ex: Apple ProRes 422, H.264"
                      />
                      {videoMetadata?.codecName && videoMetadata.codecName !== videoMetadata.codec && (
                        <p className="text-[9px] text-gray-400 mt-1">Detectado: {videoMetadata.codecName}</p>
                      )}
                    </div>
                    {videoMetadata?.colorSpace && (
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                          Espaço de Cor
                        </label>
                        <input
                          type="text"
                          className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
                          value={videoMetadata.colorSpace || ''}
                          onChange={(e) => setVideoMetadata(prev => ({ ...prev, colorSpace: e.target.value || undefined }))}
                          placeholder="Ex: bt709, smpte170m"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                        Orientação
                      </label>
                      <select
                        className="flex h-12 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 transition-all"
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
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={videoMetadata?.hasAlpha || false}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, hasAlpha: e.target.checked }))}
                      />
                      <span className="text-sm font-semibold text-gray-700">Canal Alfa (Transparência)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={videoMetadata?.hasLoop || false}
                        onChange={(e) => setVideoMetadata(prev => ({ ...prev, hasLoop: e.target.checked }))}
                      />
                      <span className="text-sm font-semibold text-gray-700">Com Loop</span>
                    </label>
                  </div>
                  {videoMetadata && (videoMetadata.width || videoMetadata.height) && (
                    <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-xl space-y-1">
                      <p className="text-xs font-semibold text-primary-700">
                        Resolução: {videoMetadata.width} × {videoMetadata.height}
                        {videoMetadata.duration && ` • ${Math.round(videoMetadata.duration)}s`}
                        {videoMetadata.frameRate && ` • ${videoMetadata.frameRate.toFixed(2)} fps`}
                      </p>
                      {videoMetadata.codec && (
                        <p className="text-xs text-primary-600">
                          Codec: {videoMetadata.codec}
                          {videoMetadata.audioCodec && ` • Áudio: ${videoMetadata.audioCodec.toUpperCase()}`}
                        </p>
                      )}
                      {videoMetadata.colorSpace && (
                        <p className="text-xs text-primary-600">
                          Espaço de Cor: {videoMetadata.colorSpace}
                          {videoMetadata.hasTimecode && ` • Com Timecode`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Input
                label="Tags (Vírgulas)"
                placeholder="moderno, psd, tech"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              />

              {/* Campo de Coleção */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                  Coleção (Opcional)
                </label>
                <div className="space-y-3">
                  {!showNewCollectionForm ? (
                    <>
                      {newCollectionTitle.trim() && (
                        <div className="p-3 bg-primary-50 border border-primary-200 rounded-xl mb-3">
                          <p className="text-xs font-semibold text-primary-700 mb-1">Nova coleção será criada:</p>
                          <p className="text-sm font-bold text-primary-900">{newCollectionTitle}</p>
                          <button
                            type="button"
                          onClick={() => {
                            setNewCollectionTitle('')
                            // Quando remover a nova coleção, manter o is_premium atual
                            setFormData({ ...formData, collection_id: '' })
                          }}
                            className="mt-2 text-xs text-primary-600 hover:text-primary-700 underline"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                      <select
                        className="flex h-14 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/20 transition-all appearance-none"
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
                          className="flex items-center gap-2 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Criar nova coleção
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3 p-4 bg-primary-50/30 rounded-2xl border border-primary-100">
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
                        className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors"
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
                    ? 'bg-primary-50/30 border-primary-200' 
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
                      <div className={`block w-14 h-8 rounded-full transition-all ${formData.is_premium ? 'bg-primary-500' : 'bg-gray-300'} ${isPremiumLocked ? 'opacity-75' : ''}`} />
                      <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all transform ${formData.is_premium ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <div className="ml-4 flex flex-col">
                      <span className="text-xs font-semibold text-gray-700 tracking-tighter uppercase">
                        Este recurso é Premium
                        {isPremiumCollection && (
                          <span className="ml-2 text-primary-600 text-[10px] font-normal">
                            (Definido pela coleção)
                          </span>
                        )}
                        {isOfficial && (
                          <span className="ml-2 text-primary-600 text-[10px] font-normal">
                            (Definido por ser oficial)
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium tracking-tight">
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
                        <div className={`block w-14 h-8 rounded-full transition-all ${formData.is_official ? 'bg-primary-500' : 'bg-gray-700'}`} />
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all transform ${formData.is_official ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                      <div className="ml-4 flex flex-col">
                        <span className="text-xs font-bold text-white tracking-tighter uppercase flex items-center gap-2">
                          <ShieldCheck className="h-3 w-3 text-primary-500" />
                          Arquivo Oficial BrasilPSD
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">O sistema aparecerá como autor oficial (será premium automaticamente)</span>
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
                    accept="image/*,video/*,.psd,.ai,.zip,.rar,.7z"
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

            {(preview || videoPreview) && (
              <div className="mt-8 rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                <p className="p-4 bg-gray-50 text-[10px] font-semibold text-gray-400 tracking-widest border-b border-gray-100 uppercase">Pré-visualização</p>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Preview" className="w-full h-auto max-h-[400px] object-contain mx-auto" />
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
                      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm space-y-1">
                        <div>
                          {videoMetadata.width} × {videoMetadata.height}
                          {videoMetadata.duration && (
                            <span className="ml-2">
                              • {Math.round(videoMetadata.duration)}s
                            </span>
                          )}
                        </div>
                        {videoMetadata.frameRate && (
                          <div className="text-[10px] opacity-90">
                            {videoMetadata.frameRate.toFixed(2)} fps
                            {videoMetadata.encoding && ` • ${videoMetadata.encoding}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
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
                  <div className="space-y-3 pt-2">
                    {/* Informações principais em destaque */}
                    <div className="flex items-center justify-between p-3 bg-primary-50 rounded-xl border border-primary-100">
                      <div className="flex-1">
                        <div className="text-[9px] font-semibold text-primary-600 uppercase tracking-wider mb-1">Enviado</div>
                        <div className="text-base font-black text-primary-700">
                          {formatBytes(uploadStats.bytesUploaded)} <span className="text-xs font-semibold text-primary-500">/ {formatBytes(uploadStats.totalBytes)}</span>
                        </div>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="text-[9px] font-semibold text-primary-600 uppercase tracking-wider mb-1">Velocidade</div>
                        <div className="text-base font-black text-primary-700">{formatSpeed(uploadStats.speed)}</div>
                      </div>
                    </div>
                    
                    {/* Informações secundárias */}
                    <div className="grid grid-cols-2 gap-3">
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
                  </div>
                )}
                {uploadPhase === 'processing' && (
                  <div className="pt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Arquivo enviado</span>
                      <span className="text-xs font-bold text-gray-900">
                        {formatBytes(uploadStats.totalBytes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Processando no servidor</span>
                      <span className="text-xs font-bold text-primary-600 animate-pulse">Em andamento...</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Tempo total</span>
                      <span className="text-xs font-bold text-gray-700">
                        {formatTime((Date.now() - uploadStats.startTime) / 1000)}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 font-medium text-center italic pt-2">
                  {uploadPhase === 'processing' ? 'Processando e otimizando arquivo no servidor...' : 'Não feche esta página.'}
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Image as ImageIcon, Edit2, Check, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ResourceType, Profile } from '@/types/database'
import Image from 'next/image'

interface BatchImage {
  id: string
  file: File
  preview: string
  title: string
  description: string
  keywords: string[]
  category_ids: string[] // Múltiplas categorias
  is_premium: boolean
  collection_id: string
  metadata: any
  isProcessing: boolean
  isReady: boolean
  categoriesSuggested: boolean // Indica se as categorias foram sugeridas pela IA
}

export default function BatchUploadPage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [images, setImages] = useState<BatchImage[]>([])
  const [editingImageId, setEditingImageId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingIndex, setProcessingIndex] = useState(0)
  const [applyCategoryToAll, setApplyCategoryToAll] = useState<string>('') // Categoria selecionada para aplicar a todas
  
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

        // Buscar categoria "Imagens" e suas subcategorias
        const { data: imagensCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', 'imagens')
          .is('parent_id', null)
          .maybeSingle()
        
        let imageCategories: any[] = []
        
        if (imagensCategory) {
          // Buscar a categoria principal e todas suas subcategorias
          const { data: mainCat } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('id', imagensCategory.id)
            .single()
          
          const { data: subCats } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('parent_id', imagensCategory.id)
            .order('order_index', { ascending: true })
            .order('name', { ascending: true })
          
          // Combinar categoria principal e subcategorias
          imageCategories = [
            ...(mainCat ? [mainCat] : []),
            ...(subCats || [])
          ]
        } else {
          // Fallback: buscar todas as categorias se "Imagens" não existir
          const { data: cats } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .order('name')
          
          imageCategories = cats || []
        }
        
        console.log('Categorias de imagens carregadas:', imageCategories?.length || 0)
        setCategories(imageCategories)

        if (user) {
          const { data: userCollections } = await supabase
            .from('collections')
            .select('id, title, is_premium')
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false })
          
          setCollections(userCollections || [])
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        toast.error('Erro ao carregar dados')
      }
    }
    
    loadInitialData()
  }, [supabase])

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    const imageFiles = files.filter(f => f.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      toast.error('Por favor, selecione apenas arquivos de imagem')
      return
    }

    // Garantir que as categorias estejam carregadas antes de processar
    if (categories.length === 0) {
      toast.loading('Carregando categorias...', { id: 'loading-categories' })
      // Aguardar um pouco para garantir que as categorias sejam carregadas
      await new Promise(resolve => setTimeout(resolve, 500))
      toast.dismiss('loading-categories')
      
      if (categories.length === 0) {
        toast.error('Erro: Categorias não carregadas. Por favor, recarregue a página.')
        return
      }
    }

    toast.loading(`Processando ${imageFiles.length} imagem(ns)...`, { id: 'processing' })

    const newImages: BatchImage[] = []

    for (const file of imageFiles) {
      const id = `${Date.now()}-${Math.random()}`
      const preview = URL.createObjectURL(file)

      const imageData: BatchImage = {
        id,
        file,
        preview,
        title: '',
        description: '',
        keywords: [],
        category_ids: [],
        is_premium: false,
        collection_id: '',
        metadata: {},
        isProcessing: true,
        isReady: false,
        categoriesSuggested: false,
      }

      newImages.push(imageData)
      setImages(prev => [...prev, imageData])

      // Processar metadados e gerar conteúdo
      try {
        await processImageMetadata(imageData)
      } catch (error) {
        console.error(`Erro ao processar ${file.name}:`, error)
        toast.error(`Erro ao processar ${file.name}`)
      }
    }

    toast.dismiss('processing')
    toast.success(`${imageFiles.length} imagem(ns) processada(s)!`)
  }

  async function processImageMetadata(image: BatchImage) {
    try {
      console.log('🚀 Iniciando processamento da imagem:', image.file.name)
      
      // 1. Extrair metadados básicos da imagem
      console.log('📊 Extraindo metadados...')
      const formData = new FormData()
      formData.append('file', image.file)
      
      const metadataResponse = await fetch('/api/image/extract-metadata', {
        method: 'POST',
        body: formData,
      })

      let metadata = {}
      if (metadataResponse.ok) {
        const data = await metadataResponse.json()
        metadata = data.metadata || {}
        console.log('✅ Metadados extraídos:', Object.keys(metadata))
      } else {
        console.warn('⚠️ Erro ao extrair metadados')
      }

      // 2. Converter imagem para base64 para análise visual (otimizada)
      let imageBase64: string | null = null
      try {
        console.log('🖼️ Converting image to base64 for AI analysis...')
        
        // Criar uma imagem temporária para redimensionar
        const img = document.createElement('img')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        const imageUrl = URL.createObjectURL(image.file)
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Redimensionar para máximo 1024px na maior dimensão (para otimizar)
            const maxSize = 1024
            let width = img.width
            let height = img.height
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width
                width = maxSize
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height
                height = maxSize
              }
            }
            
            canvas.width = width
            canvas.height = height
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height)
              // Converter para base64 JPEG com qualidade 85%
              imageBase64 = canvas.toDataURL('image/jpeg', 0.85)
              console.log('✅ Image converted to base64:', {
                originalSize: `${img.width}x${img.height}`,
                resizedSize: `${width}x${height}`,
                base64Length: imageBase64.length
              })
            }
            
            URL.revokeObjectURL(imageUrl)
            resolve()
          }
          img.onerror = (error) => {
            console.error('❌ Error loading image:', error)
            URL.revokeObjectURL(imageUrl)
            reject(error)
          }
          img.src = imageUrl
        })
      } catch (error) {
        console.warn('⚠️ Erro ao converter imagem para base64:', error)
        // Fallback: usar FileReader se canvas falhar
        try {
          console.log('🔄 Trying fallback conversion with FileReader...')
          const reader = new FileReader()
          imageBase64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              console.log('✅ Fallback conversion successful')
              resolve(reader.result as string)
            }
            reader.onerror = reject
            reader.readAsDataURL(image.file)
          })
        } catch (fallbackError) {
          console.error('❌ Erro no fallback de conversão:', fallbackError)
        }
      }
      
      if (!imageBase64) {
        console.warn('⚠️ Could not convert image to base64, AI will use metadata only')
      }

      // 3. Gerar título, descrição e categoria usando ChatGPT com análise visual
      // Garantir que temos categorias antes de chamar a IA
      if (categories.length === 0) {
        console.warn('⚠️ No categories available, waiting...')
        // Tentar aguardar um pouco mais
        await new Promise(resolve => setTimeout(resolve, 1000))
        if (categories.length === 0) {
          console.error('❌ Still no categories after wait')
          throw new Error('Categorias não disponíveis')
        }
      }

      console.log('🤖 Sending to AI:', {
        fileName: image.file.name,
        hasImageBase64: !!imageBase64,
        imageBase64Length: imageBase64?.substring(0, 50) || 'none',
        categoriesCount: categories.length,
        categories: categories.map((c: any) => ({ id: c.id, name: c.name }))
      })
      
      // Atualizar estado para mostrar que está chamando a IA
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, isProcessing: true }
          : img
      ))

      const aiResponse = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            ...metadata,
            fileSize: image.file.size,
            fileType: image.file.type,
          },
          fileName: image.file.name, // Sempre passar fileName como contexto adicional
          categories: categories.length > 0 ? categories : undefined, // Passar categorias apenas se disponíveis
          imageBase64: imageBase64, // Enviar imagem para análise visual
          generateDescription: false, // Não gerar descrição, apenas título
        }),
      })

      let title = image.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      let description = ''
      let keywords: string[] = []
      let categoryIds: string[] = []

      if (aiResponse.ok) {
        let aiData: any = {}
        try {
          const responseText = await aiResponse.text()
          console.log('📥 Raw AI Response:', responseText.substring(0, 500))
          
          // Tentar parsear o JSON
          try {
            aiData = JSON.parse(responseText)
          } catch (parseError) {
            console.error('❌ Failed to parse JSON, trying to extract...', parseError)
            // Tentar extrair JSON de dentro de markdown code blocks
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              aiData = JSON.parse(jsonMatch[0])
            } else {
              throw new Error('No JSON found in response')
            }
          }
        } catch (error: any) {
          console.error('❌ Error parsing AI response:', error)
          toast.error('Erro ao processar resposta da IA. Tente novamente.', { duration: 5000 })
          throw error
        }

        console.log('✅ AI Response received:', {
          title: aiData.title,
          hasDescription: !!aiData.description,
          keywordsCount: aiData.keywords?.length || 0,
          categoryIds: aiData.category_ids || [],
          categoryId: aiData.category_id || null,
          fullResponse: aiData
        })
        
        // Aplicar título da IA se existir
        if (aiData.title && typeof aiData.title === 'string' && aiData.title.trim()) {
          title = aiData.title.trim()
          console.log('✅ Title applied from AI:', title)
          toast.success(`Título gerado: "${title}"`, { duration: 3000 })
        } else {
          console.warn('⚠️ No title from AI, using filename')
        }
        
        // Não usar descrição da IA (generateDescription: false)
        description = ''
        keywords = Array.isArray(aiData.keywords) ? aiData.keywords : []
        
        // Suportar tanto category_id (único) quanto category_ids (múltiplas)
        if (aiData.category_ids && Array.isArray(aiData.category_ids) && aiData.category_ids.length > 0) {
          // Validar que os IDs existem nas categorias disponíveis
          categoryIds = aiData.category_ids.filter((id: string) => {
            const exists = categories.some((c: any) => c.id === id)
            if (!exists) {
              console.warn(`⚠️ Category ID ${id} not found in available categories`)
            }
            return exists
          })
          
          if (categoryIds.length > 0) {
            console.log('✅ Categories from AI (array):', categoryIds)
            const categoryNames = categoryIds.map(id => {
              const cat = categories.find((c: any) => c.id === id)
              return cat?.name || id
            }).join(', ')
            toast.success(`Categorias selecionadas: ${categoryNames}`, { duration: 3000 })
          } else {
            console.warn('⚠️ No valid categories found after filtering')
            toast.error('IA selecionou categorias inválidas. Selecione manualmente.', { duration: 4000 })
          }
        } else if (aiData.category_id && typeof aiData.category_id === 'string') {
          // Validar que o ID existe
          const categoryExists = categories.some((c: any) => c.id === aiData.category_id)
          if (categoryExists) {
            categoryIds = [aiData.category_id]
            console.log('✅ Category from AI (single):', categoryIds)
            const cat = categories.find((c: any) => c.id === aiData.category_id)
            if (cat) {
              toast.success(`Categoria selecionada: ${cat.name}`, { duration: 3000 })
            }
          } else {
            console.warn(`⚠️ Category ID ${aiData.category_id} not found in available categories`)
            toast.error('IA selecionou categoria inválida. Selecione manualmente.', { duration: 4000 })
          }
        } else {
          console.warn('⚠️ No categories from AI response')
          console.warn('AI Response structure:', Object.keys(aiData))
          toast.error('IA não conseguiu selecionar categorias. Selecione manualmente.', { duration: 4000 })
        }
      } else {
        const errorText = await aiResponse.text()
        console.error('❌ AI Response error:', {
          status: aiResponse.status,
          statusText: aiResponse.statusText,
          body: errorText.substring(0, 500)
        })
        try {
          const errorData = JSON.parse(errorText)
          console.error('❌ AI Error details:', errorData)
          toast.error(`Erro na IA: ${errorData.error || 'Erro desconhecido'}`, { duration: 5000 })
        } catch {
          toast.error(`Erro na IA: ${aiResponse.status} ${aiResponse.statusText}`, { duration: 5000 })
        }
      }

      // 3. Atualizar imagem com dados processados
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? {
              ...img,
              title,
              description,
              keywords,
              category_ids: categoryIds,
              categoriesSuggested: categoryIds.length > 0, // Marcar como sugeridas se tiver categorias
              metadata,
              isProcessing: false,
              isReady: true,
            }
          : img
      ))
    } catch (error: any) {
      console.error('Erro ao processar metadados:', error)
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? {
              ...img,
              title: image.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
              description: '',
              keywords: [],
              category_ids: [],
              isProcessing: false,
              isReady: true,
            }
          : img
      ))
    }
  }

  function updateImage(id: string, updates: Partial<BatchImage>) {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, ...updates } : img
    ))
  }

  function removeImage(id: string) {
    setImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  async function handleBatchUpload() {
    const readyImages = images.filter(img => img.isReady && img.title.trim())
    
    if (readyImages.length === 0) {
      toast.error('Nenhuma imagem pronta para upload')
      return
    }

    if (!readyImages.every(img => img.category_ids.length > 0)) {
      toast.error('Todas as imagens precisam ter pelo menos uma categoria selecionada')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setProcessingIndex(0)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < readyImages.length; i++) {
      const image = readyImages[i]
      setProcessingIndex(i + 1)

      try {
        await uploadSingleImage(image)
        successCount++
        setUploadProgress(((i + 1) / readyImages.length) * 100)
      } catch (error: any) {
        console.error(`Erro ao fazer upload de ${image.file.name}:`, error)
        errorCount++
        toast.error(`Erro ao fazer upload de ${image.file.name}`)
      }
    }

    setIsUploading(false)
    
    if (successCount > 0) {
      toast.success(`${successCount} imagem(ns) enviada(s) com sucesso!`)
      router.push('/creator')
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} imagem(ns) falharam no upload`)
    }
  }

  async function uploadSingleImage(image: BatchImage) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    // 1. Verificar tamanho do arquivo e escolher método de upload
    const fileSizeMB = image.file.size / (1024 * 1024)
    const usePresignedUrl = fileSizeMB > 4.5

    let fileUrl: string
    let previewUrl: string | null = null
    let thumbnailUrl: string | null = null
    let isAiGenerated = false
    let videoMetadata: any = null
    let imageMetadata: any = null

    if (usePresignedUrl) {
      // Upload direto para S3 usando presigned URL (para arquivos grandes)
      console.log(`📤 Arquivo grande (${fileSizeMB.toFixed(2)}MB), usando presigned URL`)
      
      // Obter presigned URL
      const presignedResponse = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: image.file.name,
          contentType: image.file.type,
          fileSize: image.file.size,
          type: 'resource'
        })
      })

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json()
        throw new Error(error.error || 'Erro ao gerar URL de upload')
      }

      const { presignedUrl, key, url } = await presignedResponse.json()

      // Upload direto para S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            console.log(`📤 Upload progress: ${percent}%`)
          }
        })

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('✅ Upload direto concluído')
            resolve()
          } else {
            reject(new Error(`Erro ${xhr.status} no upload direto`))
          }
        }

        xhr.onerror = () => {
          reject(new Error('Erro de rede no upload'))
        }

        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', image.file.type)
        xhr.send(image.file)
      })

      fileUrl = url
      
      // Para arquivos grandes via presigned URL, processar depois
      // Chamar API para processar (gerar preview, thumbnail, detectar IA)
      try {
        console.log('🔄 Processando arquivo grande após upload...')
        const processResponse = await fetch('/api/upload/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: key, // Usar a key retornada pelo presigned
            fileName: image.file.name,
            contentType: image.file.type,
            type: 'resource'
          })
        })
        
        if (processResponse.ok) {
          const processData = await processResponse.json()
          previewUrl = processData.previewUrl || null
          thumbnailUrl = processData.thumbnailUrl || null
          isAiGenerated = processData.isAiGenerated || false
          imageMetadata = processData.imageMetadata || null
          console.log('✅ Arquivo grande processado:', {
            hasPreview: !!previewUrl,
            hasThumbnail: !!thumbnailUrl,
            isAiGenerated
          })
        } else {
          const errorData = await processResponse.json().catch(() => ({}))
          console.warn('⚠️ Erro ao processar arquivo grande:', errorData.error || 'Erro desconhecido')
          // Continuar mesmo se o processamento falhar
        }
      } catch (processError: any) {
        console.warn('⚠️ Erro ao processar arquivo grande:', processError.message)
        // Continuar mesmo se o processamento falhar
      }
    } else {
      // Upload normal via API (para arquivos menores que 4.5MB)
      console.log(`📤 Arquivo pequeno (${fileSizeMB.toFixed(2)}MB), usando upload normal`)
      
      const formData = new FormData()
      formData.append('file', image.file)
      formData.append('type', 'resource')

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Erro ao fazer upload')
      }

      const uploadData = await uploadResponse.json()
      fileUrl = uploadData.url
      previewUrl = uploadData.previewUrl || null
      thumbnailUrl = uploadData.thumbnailUrl || null
      isAiGenerated = uploadData.isAiGenerated || false
      videoMetadata = uploadData.videoMetadata || null
      imageMetadata = uploadData.imageMetadata || null
    }

    // 2. Se a imagem foi detectada como gerada por IA, adicionar categoria "IA" automaticamente
    if (isAiGenerated) {
      // Buscar categoria "IA"
      const { data: iaCategory } = await supabase
        .from('categories')
        .select('id, name, slug')
        .or('slug.eq.ia,slug.eq.ai,name.ilike.%IA%')
        .maybeSingle()
      
      if (iaCategory && !image.category_ids.includes(iaCategory.id)) {
        // Adicionar categoria "IA" ao estado da imagem
        const updatedCategoryIds = [iaCategory.id, ...image.category_ids]
        setImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, category_ids: updatedCategoryIds }
            : img
        ))
        // Atualizar a variável local também
        image.category_ids = updatedCategoryIds
        console.log('✅ IA detectada: Categoria "IA" adicionada automaticamente')
        toast.success('Imagem detectada como gerada por IA. Categoria "IA" adicionada automaticamente.', { duration: 3000 })
      } else if (!iaCategory) {
        console.warn('⚠️ Categoria "IA" não encontrada no banco de dados')
      }
    }

    // 3. Buscar perfil do usuário para verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    // 3. Detectar tipo de recurso baseado na extensão do arquivo
    const fileExtension = image.file.name.split('.').pop()?.toLowerCase() || ''
    const isPng = fileExtension === 'png'
    const resourceType: ResourceType = isPng ? 'png' : 'image'
    
    // 4. Se for PNG, garantir que está associado à categoria "Imagens" também
    let finalCategoryIds = [...image.category_ids]
    if (isPng) {
      // Buscar categoria "Imagens"
      const { data: imagensCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'imagens')
        .is('parent_id', null)
        .maybeSingle()
      
      if (imagensCategory && !finalCategoryIds.includes(imagensCategory.id)) {
        // Adicionar categoria "Imagens" se ainda não estiver na lista
        finalCategoryIds = [imagensCategory.id, ...finalCategoryIds]
        console.log('✅ PNG: Adicionada categoria "Imagens" automaticamente')
      }
    }
    
    // 5. Se a imagem foi detectada como gerada por IA, adicionar categoria "IA" automaticamente
    if (isAiGenerated) {
      // Buscar categoria "IA" (pode ser slug "ia" ou "ai")
      const { data: iaCategory } = await supabase
        .from('categories')
        .select('id')
        .or('slug.eq.ia,slug.eq.ai,name.ilike.%IA%')
        .maybeSingle()
      
      if (iaCategory && !finalCategoryIds.includes(iaCategory.id)) {
        // Adicionar categoria "IA" se ainda não estiver na lista
        finalCategoryIds = [iaCategory.id, ...finalCategoryIds]
        console.log('✅ IA: Adicionada categoria "IA" automaticamente')
        
        // Atualizar o estado da imagem para refletir a categoria adicionada
        setImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, category_ids: finalCategoryIds }
            : img
        ))
      } else if (!iaCategory) {
        console.warn('⚠️ Categoria "IA" não encontrada no banco de dados')
      }
    }
    
    // 5. Salvar recurso no banco de dados
    // Usar a primeira categoria como category_id principal (para compatibilidade)
    const primaryCategoryId = finalCategoryIds.length > 0 ? finalCategoryIds[0] : null
    
    // Usar imageMetadata do servidor se disponível (mais confiável), senão usar do cliente
    const finalWidth = imageMetadata?.width 
      ? Number(imageMetadata.width) 
      : (image.metadata?.width ? Number(image.metadata.width) : null)
    const finalHeight = imageMetadata?.height 
      ? Number(imageMetadata.height) 
      : (image.metadata?.height ? Number(image.metadata.height) : null)
    
    const resourceData: any = {
      title: image.title,
      description: image.description || null,
      resource_type: resourceType,
      category_id: primaryCategoryId, // Primeira categoria como principal
      creator_id: user.id,
      file_url: fileUrl,
      preview_url: previewUrl || null,
      thumbnail_url: thumbnailUrl || null,
      file_size: image.file.size,
      file_format: fileExtension,
      width: finalWidth,
      height: finalHeight,
      keywords: image.keywords.length > 0 ? image.keywords : [],
      is_premium: image.is_premium || false,
      is_official: false,
      is_ai_generated: isAiGenerated || false,
      status: profile?.is_admin ? 'approved' : 'pending',
    }

    // Se for PNG, usar a API route especial para inserção
    let resource
    if (isPng) {
      console.log('📸 PNG detected - using API route for direct database insert')
      try {
        const response = await fetch('/api/resources/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resourceData)
        })
        
        const result = await response.json()
        
        if (response.ok && result.data) {
          resource = result.data
          console.log('✅ PNG resource inserted successfully via API route')
        } else {
          throw new Error(result.error || 'Erro ao inserir via API')
        }
      } catch (apiErr: any) {
        console.error('❌ Error calling API route:', apiErr)
        // Tentar inserção normal como fallback
        const { data, error: insertError } = await supabase
          .from('resources')
          .insert({ ...resourceData, resource_type: 'image' }) // Fallback para 'image'
          .select()
          .single()
        
        if (insertError) {
          console.error('Erro ao salvar recurso no banco:', insertError)
          throw new Error(`Erro ao salvar no banco: ${insertError.message}`)
        }
        resource = data
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('resources')
        .insert(resourceData)
        .select()
        .single()

      if (insertError) {
        console.error('Erro ao salvar recurso no banco:', insertError)
        throw new Error(`Erro ao salvar no banco: ${insertError.message}`)
      }
      resource = data
    }

    // 6. Salvar múltiplas categorias na tabela resource_categories
    if (resource && finalCategoryIds.length > 0) {
      const categoryInserts = finalCategoryIds.map(categoryId => ({
        resource_id: resource.id,
        category_id: categoryId
      }))

      const { error: categoriesError } = await supabase
        .from('resource_categories')
        .insert(categoryInserts)

      if (categoriesError) {
        console.warn('Erro ao salvar categorias:', categoriesError)
        // Não falhar o upload se houver erro ao salvar categorias
      } else {
        console.log(`✅ ${finalCategoryIds.length} categoria(s) associada(s) ao recurso`)
      }
    }

    // 5. Adicionar à coleção se selecionada
    if (image.collection_id && resource) {
      const { data: existingResources } = await supabase
        .from('collection_resources')
        .select('order_index')
        .eq('collection_id', image.collection_id)
        .order('order_index', { ascending: false })
        .limit(1)

      const nextOrderIndex = existingResources && existingResources.length > 0
        ? (existingResources[0].order_index || 0) + 1
        : 0

      const { error: collectionError } = await supabase
        .from('collection_resources')
        .insert({
          collection_id: image.collection_id,
          resource_id: resource.id,
          order_index: nextOrderIndex
        })

      if (collectionError) {
        console.warn('Erro ao adicionar à coleção:', collectionError)
        // Não falhar o upload se houver erro ao adicionar à coleção
      }
    }

    return resource
  }

  const readyCount = images.filter(img => img.isReady && img.title.trim()).length
  const processingCount = images.filter(img => img.isProcessing).length

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload em Lote</h1>
        <p className="text-gray-600">
          Faça upload de múltiplas imagens de uma vez. Títulos e descrições serão gerados automaticamente a partir dos metadados.
        </p>
      </div>

      <Card className="mb-6">
        <div className="p-6">
          <label className="block mb-4">
            <span className="block text-sm font-medium mb-2">Selecionar Imagens</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isUploading || processingCount > 0}
            />
          </label>

          {processingCount > 0 && (
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando {processingCount} imagem(ns)...</span>
            </div>
          )}

          {images.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {readyCount} de {images.length} imagem(ns) pronta(s)
                  </span>
                  {/* Opções globais para aplicar a todas as imagens */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Opção para aplicar categoria a todas */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Categoria para todas:</span>
                      <select
                        value={applyCategoryToAll}
                        onChange={(e) => {
                          const categoryId = e.target.value
                          setApplyCategoryToAll(categoryId)
                          
                          if (categoryId) {
                            const category = categories.find(c => c.id === categoryId)
                            if (category) {
                              // Adicionar a categoria selecionada a todas as imagens (sem remover as existentes)
                              setImages(prev => prev.map(img => {
                                const hasCategory = img.category_ids.includes(categoryId)
                                if (hasCategory) return img
                                
                                return {
                                  ...img,
                                  category_ids: [...img.category_ids, categoryId]
                                }
                              }))
                              toast.success(`Categoria "${category.name}" adicionada a todas as imagens`)
                            }
                          } else {
                            // Se selecionar "Nenhuma", não fazer nada (ou pode remover todas as categorias se necessário)
                            setApplyCategoryToAll('')
                          }
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium bg-white hover:bg-gray-50 transition-colors"
                        disabled={isUploading || categories.length === 0}
                      >
                        <option value="">Selecione uma categoria</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {applyCategoryToAll && (
                        <button
                          type="button"
                          onClick={() => {
                            // Remover a categoria selecionada de todas as imagens
                            setImages(prev => prev.map(img => ({
                              ...img,
                              category_ids: img.category_ids.filter(id => id !== applyCategoryToAll)
                            })))
                            const category = categories.find(c => c.id === applyCategoryToAll)
                            toast.success(`Categoria "${category?.name || ''}" removida de todas as imagens`)
                            setApplyCategoryToAll('')
                          }}
                          className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          disabled={isUploading}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    
                    {/* Opção global para definir licença */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Licença para todas:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setImages(prev => prev.map(img => ({ ...img, is_premium: false })))
                          toast.success('Todas as imagens definidas como Grátis')
                        }}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-colors"
                        disabled={isUploading}
                      >
                        Grátis
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImages(prev => prev.map(img => ({ ...img, is_premium: true })))
                          toast.success('Todas as imagens definidas como Premium')
                        }}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-md text-xs font-medium hover:bg-orange-600 transition-colors"
                        disabled={isUploading}
                      >
                        Premium
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleBatchUpload}
                  disabled={readyCount === 0 || isUploading}
                  className="flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando {processingIndex}/{readyCount}...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-4 h-4" />
                      Enviar {readyCount} Imagem(ns)
                    </>
                  )}
                </Button>
              </div>

              {isUploading && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {Math.round(uploadProgress)}% concluído
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map(image => (
            <Card key={image.id} className="overflow-hidden">
              <div className="relative aspect-square bg-gray-100">
                <Image
                  src={image.preview}
                  alt={image.title || image.file.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {image.isProcessing && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
                    <div className="text-center text-white">
                      <Sparkles className="w-8 h-8 animate-pulse mx-auto mb-2 text-yellow-400" />
                      <p className="text-sm font-medium">IA analisando imagem...</p>
                      <p className="text-xs mt-1 opacity-75">Gerando título e categorias</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4">
                {editingImageId === image.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Título</label>
                      <Input
                        value={image.title}
                        onChange={(e) => updateImage(image.id, { title: e.target.value })}
                        placeholder="Título da imagem"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Descrição</label>
                      <textarea
                        value={image.description}
                        onChange={(e) => updateImage(image.id, { description: e.target.value })}
                        placeholder="Descrição da imagem"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-medium mb-2">
                        Categorias (pode selecionar múltiplas)
                        {image.categoriesSuggested && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            ✨ Sugeridas pela IA
                          </span>
                        )}
                      </label>
                      <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-2">
                        {categories.map(cat => {
                          const isSelected = image.category_ids.includes(cat.id)
                          return (
                            <label
                              key={cat.id}
                              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newCategoryIds = e.target.checked
                                    ? [...image.category_ids, cat.id]
                                    : image.category_ids.filter(id => id !== cat.id)
                                  updateImage(image.id, { 
                                    category_ids: newCategoryIds,
                                    categoriesSuggested: false // Remover flag quando usuário alterar
                                  })
                                }}
                                className="rounded"
                              />
                              <span>{cat.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Coleção (opcional)</label>
                      <select
                        value={image.collection_id}
                        onChange={(e) => updateImage(image.id, { collection_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Nenhuma coleção</option>
                        {collections.map(col => (
                          <option key={col.id} value={col.id}>{col.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2">Licença</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateImage(image.id, { is_premium: false })}
                          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            !image.is_premium
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Grátis
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImage(image.id, { is_premium: true })}
                          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            image.is_premium
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Premium
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setEditingImageId(null)}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm line-clamp-2 flex-1">
                        {image.title || image.file.name}
                      </h3>
                      <button
                        onClick={() => setEditingImageId(image.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        disabled={isUploading}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        image.is_premium
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {image.is_premium ? 'Premium' : 'Grátis'}
                      </span>
                    </div>
                    {image.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {image.description}
                      </p>
                    )}
                    {image.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {image.keywords.slice(0, 3).map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                    {image.category_ids.length === 0 && (
                      <p className="text-xs text-red-600">⚠️ Pelo menos uma categoria é obrigatória</p>
                    )}
                    {image.category_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {image.category_ids.map(catId => {
                          const category = categories.find(c => c.id === catId)
                          return category ? (
                            <span
                              key={catId}
                              className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded"
                            >
                              {category.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    {image.category_ids.length > 0 && image.categoriesSuggested && (
                      <p className="text-xs text-blue-600">✨ Categorias sugeridas automaticamente pela IA</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


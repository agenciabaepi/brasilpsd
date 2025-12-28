'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Type, Info, ShieldCheck, FolderPlus, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'

export default function UploadFontPage() {
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

  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [detectedFontWeight, setDetectedFontWeight] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Carregar categorias de fontes
  useEffect(() => {
    async function loadCategories() {
      try {
        // Buscar categoria "Fontes" e suas subcategorias
        const { data: fontesCategory } = await supabase
          .from('categories')
          .select('id')
          .or('slug.eq.fontes,slug.eq.fonts')
          .is('parent_id', null)
          .maybeSingle()
        
        if (fontesCategory) {
          // Buscar a categoria principal
          const { data: mainCat } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('id', fontesCategory.id)
            .single()
          
          // Buscar subcategorias
          const { data: subCats } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('parent_id', fontesCategory.id)
            .order('order_index', { ascending: true })
            .order('name', { ascending: true })
          
          // Combinar categoria principal e subcategorias
          const fontCategories = [
            ...(mainCat ? [mainCat] : []),
            ...(subCats || [])
          ]
          setCategories(fontCategories)
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
        }

        await loadCategories()

        // Carregar coleções do usuário
        if (user) {
          const { data: collectionsData } = await supabase
            .from('collections')
            .select('*')
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false })
          setCollections(collectionsData || [])
        }
      } catch (error) {
        console.error('Error loading initial data:', error)
      }
    }

    loadInitialData()
  }, [supabase])

  // Garantir que o título seja sempre o nome base quando há múltiplos arquivos
  useEffect(() => {
    if (files.length > 1) {
      const allFileNames = files.map(f => f.name)
      const baseName = extractBaseFontName(allFileNames)
      if (baseName && formData.title !== baseName) {
        // Verificar se o título atual tem variações ou não corresponde ao nome base
        const hasVariations = /(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique)$/i.test(formData.title)
        const titleLower = formData.title.toLowerCase()
        const baseLower = baseName.toLowerCase()
        
        // Se o título tem variações ou não contém o nome base, corrigir
        if (hasVariations || !titleLower.includes(baseLower)) {
          console.log('🔧 Corrigindo título para nome base da família:', baseName)
          setFormData(prev => ({ ...prev, title: baseName }))
        }
      }
    }
  }, [files.length, formData.title])

  // Função para extrair nome base da família (removendo variações)
  function extractBaseFontName(fileNames: string[]): string {
    if (fileNames.length === 0) return ''
    
    // Remover extensões
    const namesWithoutExt = fileNames.map(name => name.replace(/\.[^/.]+$/, ''))
    
    if (fileNames.length === 1) {
      const name = namesWithoutExt[0]
      const cleaned = name
        .replace(/-?(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique|normal)$/i, '')
        .replace(/-?(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique|normal)$/i, '') // Duplo para casos como "Montserrat-Bold-Italic"
        .trim()
      console.log('📝 Nome único extraído:', { original: name, cleaned })
      return cleaned
    }

    // Para múltiplos arquivos, limpar cada nome e encontrar o prefixo comum
    const baseNames = namesWithoutExt.map(name => {
      return name
        .replace(/-?(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique|normal)$/i, '')
        .replace(/-?(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique|normal)$/i, '')
        .trim()
    })

    console.log('📝 Nomes limpos:', baseNames)

    // Encontrar o prefixo comum mais longo
    if (baseNames.length === 0) return namesWithoutExt[0]
    
    let commonPrefix = baseNames[0]
    for (let i = 1; i < baseNames.length; i++) {
      const current = baseNames[i]
      let j = 0
      // Comparar caractere por caractere (case-insensitive)
      while (j < commonPrefix.length && j < current.length && 
             commonPrefix[j].toLowerCase() === current[j].toLowerCase()) {
        j++
      }
      commonPrefix = commonPrefix.substring(0, j)
    }

    const result = commonPrefix || baseNames[0]
    console.log('✅ Nome base da família extraído:', result)
    return result
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    // Validar formato de fonte para todos os arquivos
    const validExtensions = ['.ttf', '.otf', '.woff', '.woff2', '.eot']
    const invalidFiles: string[] = []
    const tooLargeFiles: string[] = []

    selectedFiles.forEach(file => {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      if (!validExtensions.includes(fileExtension)) {
        invalidFiles.push(file.name)
      }
      if (file.size > 10 * 1024 * 1024) {
        tooLargeFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      toast.error(`Formato inválido: ${invalidFiles.join(', ')}. Use TTF, OTF, WOFF, WOFF2 ou EOT.`)
      return
    }

    if (tooLargeFiles.length > 0) {
      toast.error(`Arquivos muito grandes (máx. 10MB): ${tooLargeFiles.join(', ')}`)
      return
    }

    setFiles(selectedFiles)
    setDetectedFontWeight(null) // Limpar peso anterior
    
    // Auto-preencher título com nome base da família
    const allFileNames = selectedFiles.map(f => f.name)
    const baseName = extractBaseFontName(allFileNames)
    
    console.log('📁 Arquivos selecionados:', {
      count: selectedFiles.length,
      names: allFileNames,
      baseName: baseName
    })
    
    // Se houver múltiplos arquivos, sempre usar o nome base
    if (selectedFiles.length > 1 && baseName) {
      console.log('✅ Família detectada! Título atualizado para:', baseName)
      setFormData(prev => ({ ...prev, title: baseName }))
    } else if (!formData.title && selectedFiles.length > 0) {
      // Se for arquivo único e não tem título, usar o nome base limpo
      setFormData(prev => ({ ...prev, title: baseName || allFileNames[0].replace(/\.[^/.]+$/, '') }))
    } else if (formData.title && selectedFiles.length > 1) {
      // Se já tem título mas selecionou múltiplos arquivos, atualizar para nome base
      const hasVariations = /(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique)$/i.test(formData.title)
      if (hasVariations && baseName) {
        console.log('✅ Título com variações detectado. Atualizando para:', baseName)
        setFormData(prev => ({ ...prev, title: baseName }))
      }
    }

    // Detectar automaticamente categoria e peso pela IA para TODOS os arquivos
    if (selectedFiles.length > 0) {
      setTimeout(() => {
        // Se houver múltiplos arquivos, processar todos
        if (selectedFiles.length > 1) {
          processAllFontsWithAI(selectedFiles)
        } else {
          generateContentWithAI(selectedFiles[0])
        }
      }, 100)
    }
  }

  async function processAllFontsWithAI(fontFiles: File[]) {
    setIsAiProcessing(true)
    setAiError(null)
    
    toast.loading(`Processando ${fontFiles.length} fonte(s) com IA...`, { id: 'processing-fonts' })
    
    try {
      // Se houver múltiplos arquivos, analisar todos para identificar a família
      const allFileNames = fontFiles.map(f => f.name)
      const baseFontName = extractBaseFontName(allFileNames)
      const isFamily = fontFiles.length > 1
      
      const firstFile = fontFiles[0]
      const fileName = firstFile.name
      const fileExtension = firstFile.name.split('.').pop()?.toLowerCase() || 'ttf'
      const fileSize = firstFile.size
      
      // Preparar metadados da fonte
      const metadata = {
        fileName: isFamily ? baseFontName : fileName,
        fileExtension: fileExtension.toUpperCase(),
        fileSize,
        format: fileExtension,
        isFamily: isFamily,
        familySize: fontFiles.length,
        allFileNames: isFamily ? allFileNames : undefined
      }
      
      // Buscar categorias de fontes
      const { data: fontesCategory } = await supabase
        .from('categories')
        .select('id')
        .or('slug.eq.fontes,slug.eq.fonts')
        .is('parent_id', null)
        .maybeSingle()
      
      let categoriesList: any[] = []
      if (fontesCategory) {
        const { data: mainCat } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('id', fontesCategory.id)
          .single()
        
        const { data: subCats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('parent_id', fontesCategory.id)
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
          resourceType: 'font',
          generateDescription: false // Não gerar descrição, apenas título
        }),
      })
      
      if (!aiResponse.ok) {
        throw new Error('Erro ao gerar conteúdo com IA')
      }
      
      const aiData = await aiResponse.json()
      
      // PRIORIDADE ABSOLUTA: Se for família, SEMPRE usar o nome base (sem variações)
      if (isFamily && baseFontName) {
        setFormData(prev => ({ ...prev, title: baseFontName }))
      } else if (aiData.title) {
        setFormData(prev => ({ ...prev, title: aiData.title }))
      }
      
      // Não usar descrição da IA (generateDescription: false)
      // Descrição será vazia
      
      if (aiData.keywords && aiData.keywords.length > 0) {
        let keywords = aiData.keywords
        if (isFamily) {
          keywords = keywords.filter(k => 
            !['black', 'bold', 'thin', 'light', 'regular', 'medium', 'semibold', 'extrabold', 'heavy', 'italic', 'oblique'].includes(k.toLowerCase())
          )
          keywords = [...keywords, 'família', 'family', 'completa']
        }
        setFormData(prev => ({ ...prev, keywords: keywords.join(', ') }))
      } else if (isFamily) {
        setFormData(prev => ({ ...prev, keywords: 'família, family, completa' }))
      }
      
      if (aiData.category_id || (aiData.category_ids && aiData.category_ids.length > 0)) {
        const categoryId = aiData.category_id || aiData.category_ids[0]
        setFormData(prev => ({ ...prev, category_id: categoryId }))
      }
      
      if (aiData.font_weight) {
        setDetectedFontWeight(aiData.font_weight)
      }
      
      toast.dismiss('processing-fonts')
      toast.success(`${fontFiles.length} fonte(s) processada(s) pela IA!`)
    } catch (error: any) {
      console.error('Erro ao processar fontes:', error)
      setAiError(error.message || 'Erro ao processar fontes com IA')
      toast.dismiss('processing-fonts')
      toast.error('Erro ao processar fontes com IA')
    } finally {
      setIsAiProcessing(false)
    }
  }

  async function generateContentWithAI(fontFile?: File) {
    const fileToAnalyze = fontFile || files[0]
    if (!fileToAnalyze) {
      toast.error('Selecione um arquivo de fonte primeiro')
      return
    }

    setIsAiProcessing(true)
    setAiError(null)

    try {
      // Se houver múltiplos arquivos, analisar todos para identificar a família
      const allFileNames = files.map(f => f.name)
      const baseFontName = extractBaseFontName(allFileNames)
      const isFamily = files.length > 1

      const fileName = fileToAnalyze.name
      const fileExtension = fileToAnalyze.name.split('.').pop()?.toLowerCase() || 'ttf'
      const fileSize = fileToAnalyze.size

      // Preparar metadados da fonte
      const metadata = {
        fileName: isFamily ? baseFontName : fileName,
        fileExtension: fileExtension.toUpperCase(),
        fileSize,
        format: fileExtension,
        isFamily: isFamily,
        familySize: files.length,
        allFileNames: isFamily ? allFileNames : undefined
      }

      // Buscar categorias de fontes
      const { data: fontesCategory } = await supabase
        .from('categories')
        .select('id')
        .or('slug.eq.fontes,slug.eq.fonts')
        .is('parent_id', null)
        .maybeSingle()
      
      let categoriesList: any[] = []
      if (fontesCategory) {
        const { data: mainCat } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('id', fontesCategory.id)
          .single()
        
        const { data: subCats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('parent_id', fontesCategory.id)
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
          resourceType: 'font',
          generateDescription: false // Não gerar descrição, apenas título
        }),
      })

      if (!aiResponse.ok) {
        throw new Error('Erro ao gerar conteúdo com IA')
      }

      const aiData = await aiResponse.json()

      console.log('🤖 Resposta da IA:', {
        title: aiData.title,
        isFamily: files.length > 1,
        baseFontName: baseFontName,
        filesCount: files.length
      })

      // Atualizar formulário com dados da IA
      // PRIORIDADE ABSOLUTA: Se for família, SEMPRE usar o nome base (sem variações)
      // IGNORAR completamente o título da IA se for família
      if (files.length > 1 && baseFontName) {
        console.log('✅ Família detectada! Forçando título para nome base:', baseFontName)
        // Forçar o título para o nome base, ignorando qualquer variação que a IA possa ter retornado
        setFormData(prev => ({ ...prev, title: baseFontName }))
      } else if (aiData.title && files.length === 1) {
        // Só usar título da IA se for fonte única
        console.log('✅ Fonte única. Usando título da IA:', aiData.title)
        setFormData(prev => ({ ...prev, title: aiData.title }))
      }
      
      // Não usar descrição da IA (generateDescription: false)
      // Descrição será vazia
      
      if (aiData.keywords && aiData.keywords.length > 0) {
        // Adicionar "família" nas palavras-chave se houver múltiplos arquivos
        // Remover palavras-chave de peso específico se for família
        let keywords = aiData.keywords
        if (files.length > 1) {
          keywords = keywords.filter(k => 
            !['black', 'bold', 'thin', 'light', 'regular', 'medium', 'semibold', 'extrabold', 'heavy', 'italic', 'oblique'].includes(k.toLowerCase())
          )
          keywords = [...keywords, 'família', 'family', 'completa']
        }
        setFormData(prev => ({ ...prev, keywords: keywords.join(', ') }))
      } else if (files.length > 1) {
        // Se não tiver keywords mas é família, adicionar básicas
        setFormData(prev => ({ ...prev, keywords: 'família, family, completa' }))
      }
      
      if (aiData.category_id || (aiData.category_ids && aiData.category_ids.length > 0)) {
        const categoryId = aiData.category_id || aiData.category_ids[0]
        setFormData(prev => ({ ...prev, category_id: categoryId }))
        console.log('✅ Categoria identificada pela IA:', categoryId)
      }

      // Armazenar peso detectado
      if (aiData.font_weight) {
        setDetectedFontWeight(aiData.font_weight)
      }

      // Mostrar mensagem de sucesso com informações detectadas
      const detectedInfo = []
      if (aiData.font_weight) {
        detectedInfo.push(`Peso: ${aiData.font_weight}`)
      }
      if (aiData.category_id || (aiData.category_ids && aiData.category_ids.length > 0)) {
        detectedInfo.push('Categoria identificada')
      }
      
      if (detectedInfo.length > 0) {
        toast.success(`Análise concluída! ${detectedInfo.join(' • ')}`)
      } else {
        toast.success('Análise pela IA concluída!')
      }
    } catch (error: any) {
      console.error('AI generation error:', error)
      setAiError(error.message || 'Erro ao gerar conteúdo com IA')
      toast.error('Erro ao gerar conteúdo com IA. Preencha manualmente.')
    } finally {
      setIsAiProcessing(false)
    }
  }

  // Função para extrair peso da fonte do nome do arquivo
  function extractFontWeight(fileName: string): string | null {
    const name = fileName.toLowerCase()
    if (name.includes('thin')) return 'Thin'
    if (name.includes('extralight') || name.includes('extra-light')) return 'ExtraLight'
    if (name.includes('light')) return 'Light'
    if (name.includes('regular') || name.includes('normal')) return 'Regular'
    if (name.includes('medium')) return 'Medium'
    if (name.includes('semibold') || name.includes('semi-bold')) return 'SemiBold'
    if (name.includes('bold')) return 'Bold'
    if (name.includes('extrabold') || name.includes('extra-bold')) return 'ExtraBold'
    if (name.includes('black')) return 'Black'
    if (name.includes('heavy')) return 'Heavy'
    return 'Regular' // Padrão
  }

  // Função para extrair estilo da fonte do nome do arquivo
  function extractFontStyle(fileName: string): string {
    const name = fileName.toLowerCase()
    if (name.includes('italic')) return 'Italic'
    if (name.includes('oblique')) return 'Oblique'
    return 'Normal'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (files.length === 0) {
      toast.error('Selecione pelo menos um arquivo de fonte')
      return
    }

    if (!formData.title.trim()) {
      toast.error('Digite um título para a fonte')
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

      let mainResourceId: string | null = null
      const totalFiles = files.length
      let uploadedCount = 0

      // Processar cada arquivo
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileProgress = (i / totalFiles) * 100
        setUploadProgress(fileProgress)

        // 1. Upload do arquivo
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('type', 'resource')

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || `Erro ao fazer upload de ${file.name}`)
        }

        const uploadData = await uploadResponse.json()
        uploadedCount++

        // 2. Extrair informações da fonte do nome do arquivo
        const fileName = file.name.replace(/\.[^/.]+$/, '')
        const fontWeight = extractFontWeight(fileName)
        const fontStyle = extractFontStyle(fileName)
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'ttf'
        
        // Título específico para esta variação (se não for a primeira)
        const variationTitle = i === 0 
          ? formData.title 
          : `${formData.title} ${fontWeight}${fontStyle !== 'Normal' ? ` ${fontStyle}` : ''}`

        // 3. Criar recurso no banco
        const { data: resource, error: resourceError } = await supabase
          .from('resources')
          .insert({
            title: variationTitle,
            description: formData.description || null,
            resource_type: 'font',
            category_id: formData.category_id || null,
            creator_id: user.id,
            file_url: uploadData.url,
            file_size: file.size,
            file_format: fileExtension,
            keywords: keywordsArray.length > 0 ? keywordsArray : null,
            is_premium: formData.is_premium,
            is_official: formData.is_official,
            status: 'pending',
            font_family_id: mainResourceId, // NULL para a primeira, ID da primeira para as demais
            font_weight: fontWeight,
            font_style: fontStyle,
          })
          .select()
          .single()

        if (resourceError) throw resourceError

        // A primeira fonte é a principal da família
        if (i === 0) {
          mainResourceId = resource.id
          // Atualizar a primeira fonte para ter font_family_id = seu próprio ID (indica que é a principal)
          await supabase
            .from('resources')
            .update({ font_family_id: resource.id })
            .eq('id', resource.id)
        }

        // 4. Adicionar à coleção se selecionada (apenas a primeira)
        if (formData.collection_id && resource && i === 0) {
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
      }

      setUploadProgress(100)
      toast.success(
        files.length > 1 
          ? `${files.length} fontes enviadas com sucesso! Família criada. Aguardando aprovação.`
          : 'Fonte enviada com sucesso! Aguardando aprovação.'
      )
      
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
      setFiles([])
      setDetectedFontWeight(null)
      
      // Redirecionar após 1 segundo
      setTimeout(() => {
        router.push('/creator/resources')
      }, 1000)
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Erro ao fazer upload da(s) fonte(s)')
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
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Upload de Fonte</h1>
        <p className="text-gray-400 font-medium text-sm tracking-wider">
          Envie suas fontes para a comunidade BrasilPSD
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload do Arquivo */}
        <Card className="p-8">
          <div className="flex items-center mb-6">
            <Type className="h-6 w-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              {files.length > 1 ? `Arquivos da Fonte (${files.length})` : 'Arquivo da Fonte'}
            </h2>
          </div>

          {files.length === 0 ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className="w-12 h-12 mb-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                <p className="mb-2 text-sm font-semibold text-gray-500">
                  <span className="font-bold text-primary-500">Clique para fazer upload</span> ou arraste os arquivos
                </p>
                <p className="text-xs text-gray-400">
                  Formatos suportados: TTF, OTF, WOFF, WOFF2, EOT (máx. 10MB cada)
                </p>
                <p className="text-xs text-primary-600 font-medium mt-2">
                  💡 Você pode selecionar múltiplos arquivos para criar uma família de fontes
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                accept=".ttf,.otf,.woff,.woff2,.eot,font/ttf,font/otf,application/font-woff,application/font-woff2"
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3 flex-1">
                    <Type className="h-8 w-8 text-primary-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB • {file.name.split('.').pop()?.toUpperCase()}
                        {index === 0 && files.length > 1 && (
                          <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                            Principal
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newFiles = files.filter((_, i) => i !== index)
                      setFiles(newFiles)
                      if (newFiles.length === 0) {
                        setDetectedFontWeight(null)
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
              {files.length > 1 && (
                <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-xs text-primary-700">
                    <strong>Família de fontes:</strong> {files.length} variações serão agrupadas automaticamente. 
                    A primeira fonte será a principal da família.
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Informações Básicas */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              Informações da Fonte
            </h2>
            {files.length > 0 && (
              <Button
                type="button"
                onClick={() => generateContentWithAI(files[0])}
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-400 tracking-widest uppercase">
                  Título *
                </label>
                {detectedFontWeight && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary-50 border border-primary-200 rounded-lg">
                    <Sparkles className="h-3 w-3 text-primary-500" />
                    <span className="text-xs font-semibold text-primary-700">
                      Peso detectado: <span className="font-bold">{detectedFontWeight}</span>
                    </span>
                  </div>
                )}
              </div>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  // Se for família, permitir edição mas avisar se tentar adicionar variações
                  const newTitle = e.target.value
                  if (files.length > 1) {
                    // Verificar se o usuário está tentando adicionar variações
                    const hasVariations = /(bold|regular|thin|light|medium|semibold|extrabold|black|heavy|italic|oblique)$/i.test(newTitle)
                    if (hasVariations && newTitle !== formData.title) {
                      // Se tentar adicionar variações, sugerir usar apenas o nome base
                      const baseName = extractBaseFontName(files.map(f => f.name))
                      if (baseName && newTitle.toLowerCase().includes(baseName.toLowerCase())) {
                        toast.error(`Para famílias, use apenas o nome base: "${baseName}"`)
                        setFormData(prev => ({ ...prev, title: baseName }))
                        return
                      }
                    }
                  }
                  setFormData(prev => ({ ...prev, title: newTitle }))
                }}
                placeholder={files.length > 1 ? "Ex: Montserrat (nome base da família)" : "Ex: Montserrat Bold"}
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
                placeholder="Descreva a fonte, seu estilo, uso recomendado..."
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
                placeholder="Ex: sans-serif, moderno, elegante (separadas por vírgula)"
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
                <p className="text-sm font-semibold text-gray-900">Fonte Premium</p>
                <p className="text-xs text-gray-500">Esta fonte requer assinatura premium para download</p>
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
                    Fonte Oficial
                    <ShieldCheck className="h-4 w-4 text-primary-500" />
                  </p>
                  <p className="text-xs text-gray-500">Marcar como fonte oficial do BrasilPSD</p>
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
            disabled={isUploading || files.length === 0}
            isLoading={isUploading}
            className="min-w-[200px]"
          >
            {isUploading ? `Enviando... ${uploadProgress}%` : files.length > 1 ? `Enviar ${files.length} Fontes` : 'Enviar Fonte'}
          </Button>
        </div>
      </form>
    </div>
  )
}


'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload as UploadIcon, X, Music, Info, ShieldCheck, FolderPlus, Plus, Sparkles, Play, Pause } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'
import { getSystemProfileIdSync } from '@/lib/utils/system'

export default function UploadAudioPage() {
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
  const [audioPreviews, setAudioPreviews] = useState<Map<number, string>>(new Map())
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [durations, setDurations] = useState<Map<number, number>>(new Map())
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [audioTitles, setAudioTitles] = useState<Map<number, string>>(new Map()) // Títulos gerados pela IA para cada arquivo
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map())
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Carregar categorias de áudios
  useEffect(() => {
    async function loadCategories() {
      try {
        // Buscar categoria "Áudios" e suas subcategorias
        const { data: audiosCategory } = await supabase
          .from('categories')
          .select('id')
          .or('slug.eq.audios,slug.eq.áudios,slug.eq.audio')
          .is('parent_id', null)
          .maybeSingle()
        
        if (audiosCategory) {
          // Buscar a categoria principal
          const { data: mainCat } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('id', audiosCategory.id)
            .single()
          
          // Buscar subcategorias
          const { data: subCats } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('parent_id', audiosCategory.id)
            .order('order_index', { ascending: true })
            .order('name', { ascending: true })
          
          // Combinar categoria principal e subcategorias
          const audioCategories = [
            ...(mainCat ? [mainCat] : []),
            ...(subCats || [])
          ]
          setCategories(audioCategories)
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    // Validar formato de áudio para todos os arquivos
    const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma']
    const invalidFiles: string[] = []
    const tooLargeFiles: string[] = []

    selectedFiles.forEach(file => {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      if (!validExtensions.includes(fileExtension)) {
        invalidFiles.push(file.name)
      }
      if (file.size > 50 * 1024 * 1024) {
        tooLargeFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      toast.error(`Formato inválido: ${invalidFiles.join(', ')}. Use MP3, WAV, OGG, M4A, AAC, FLAC ou WMA.`)
      return
    }

    if (tooLargeFiles.length > 0) {
      toast.error(`Arquivos muito grandes (máx. 50MB): ${tooLargeFiles.join(', ')}`)
      return
    }

    setFiles(selectedFiles)
    
    // Criar previews para todos os áudios
    const newPreviews = new Map<number, string>()
    const newDurations = new Map<number, number>()
    
    selectedFiles.forEach((file, index) => {
      const audioUrl = URL.createObjectURL(file)
      newPreviews.set(index, audioUrl)
      
      // Extrair duração do áudio
      const audio = new Audio(audioUrl)
      audio.addEventListener('loadedmetadata', () => {
        setDurations(prev => {
          const updated = new Map(prev)
          updated.set(index, Math.round(audio.duration))
          return updated
        })
      })
    })
    
    setAudioPreviews(newPreviews)

    // Auto-preencher título se vazio (usar primeiro arquivo)
    if (!formData.title && selectedFiles.length > 0) {
      const fileName = selectedFiles[0].name.replace(/\.[^/.]+$/, '')
      setFormData(prev => ({ ...prev, title: fileName }))
    }

    // Detectar automaticamente categoria e informações pela IA para TODOS os arquivos
    if (selectedFiles.length > 0) {
      setTimeout(() => {
        // Se houver múltiplos arquivos, processar todos
        if (selectedFiles.length > 1) {
          processAllAudiosWithAI(selectedFiles)
        } else {
          generateContentWithAI(selectedFiles[0])
        }
      }, 100)
    }
  }

  function togglePlay(index: number) {
    const audio = audioRefs.current.get(index)
    if (!audio) return

    // Pausar todos os outros áudios
    audioRefs.current.forEach((otherAudio, otherIndex) => {
      if (otherIndex !== index && !otherAudio.paused) {
        otherAudio.pause()
        setPlayingIndex(null)
      }
    })

    if (playingIndex === index) {
      audio.pause()
      setPlayingIndex(null)
    } else {
      audio.play()
      setPlayingIndex(index)
    }
  }

  async function processAllAudiosWithAI(audioFiles: File[]) {
    setIsAiProcessing(true)
    setAiError(null)
    
    toast.loading(`Processando ${audioFiles.length} áudio(s) com IA...`, { id: 'processing-audios' })
    
    const newTitles = new Map<number, string>()
    
    try {
      // Buscar categorias de áudios uma vez
      const { data: audiosCategory } = await supabase
        .from('categories')
        .select('id')
        .or('slug.eq.audios,slug.eq.áudios,slug.eq.audio')
        .is('parent_id', null)
        .maybeSingle()
      
      let categoriesList: any[] = []
      if (audiosCategory) {
        const { data: mainCat } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('id', audiosCategory.id)
          .single()
        
        const { data: subCats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('parent_id', audiosCategory.id)
          .order('order_index', { ascending: true })
        
        categoriesList = [
          ...(mainCat ? [mainCat] : []),
          ...(subCats || [])
        ]
      }
      
      // Processar cada arquivo
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i]
        const fileName = file.name
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3'
        const fileSize = file.size
        
        const metadata = {
          fileName,
          fileExtension: fileExtension.toUpperCase(),
          fileSize,
          format: fileExtension,
          duration: durations.get(i) || undefined
        }
        
        try {
          const aiResponse = await fetch('/api/ai/generate-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              metadata,
              fileName,
              categories: categoriesList,
              resourceType: 'audio',
              generateDescription: false // Não gerar descrição, apenas título
            }),
          })
          
          if (aiResponse.ok) {
            const aiData = await aiResponse.json()
            if (aiData.title) {
              newTitles.set(i, aiData.title)
            } else {
              // Fallback: usar nome do arquivo
              newTitles.set(i, fileName.replace(/\.[^/.]+$/, ''))
            }
            
            // Usar categoria do primeiro arquivo para o formulário
            if (i === 0 && (aiData.category_id || (aiData.category_ids && aiData.category_ids.length > 0))) {
              const categoryId = aiData.category_id || aiData.category_ids[0]
              setFormData(prev => ({ ...prev, category_id: categoryId }))
            }
          } else {
            // Fallback: usar nome do arquivo
            newTitles.set(i, fileName.replace(/\.[^/.]+$/, ''))
          }
        } catch (error) {
          console.error(`Erro ao processar ${file.name}:`, error)
          // Fallback: usar nome do arquivo
          newTitles.set(i, fileName.replace(/\.[^/.]+$/, ''))
        }
      }
      
      setAudioTitles(newTitles)
      
      // Se houver apenas um arquivo, usar o título no formulário
      if (audioFiles.length === 1 && newTitles.has(0)) {
        setFormData(prev => ({ ...prev, title: newTitles.get(0) || '' }))
      }
      
      toast.dismiss('processing-audios')
      toast.success(`${audioFiles.length} áudio(s) processado(s) pela IA!`)
    } catch (error: any) {
      console.error('Erro ao processar áudios:', error)
      setAiError(error.message || 'Erro ao processar áudios com IA')
      toast.dismiss('processing-audios')
      toast.error('Erro ao processar áudios com IA')
    } finally {
      setIsAiProcessing(false)
    }
  }

  async function generateContentWithAI(audioFile?: File) {
    const fileToAnalyze = audioFile || files[0]
    if (!fileToAnalyze) {
      toast.error('Selecione um arquivo de áudio primeiro')
      return
    }

    setIsAiProcessing(true)
    setAiError(null)

    try {
      const fileName = fileToAnalyze.name
      const fileExtension = fileToAnalyze.name.split('.').pop()?.toLowerCase() || 'mp3'
      const fileSize = fileToAnalyze.size

      // Preparar metadados do áudio
      const metadata = {
        fileName,
        fileExtension: fileExtension.toUpperCase(),
        fileSize,
        format: fileExtension,
        duration: durations.get(0) || undefined
      }

      // Buscar categorias de áudios
      const { data: audiosCategory } = await supabase
        .from('categories')
        .select('id')
        .or('slug.eq.audios,slug.eq.áudios,slug.eq.audio')
        .is('parent_id', null)
        .maybeSingle()
      
      let categoriesList: any[] = []
      if (audiosCategory) {
        const { data: mainCat } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('id', audiosCategory.id)
          .single()
        
        const { data: subCats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('parent_id', audiosCategory.id)
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
          resourceType: 'audio',
          generateDescription: false // Não gerar descrição, apenas título
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
      
      // Não usar descrição da IA (generateDescription: false)
      // Descrição será vazia
      
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
    
    if (files.length === 0) {
      toast.error('Selecione pelo menos um arquivo de áudio')
      return
    }

    if (!formData.title.trim()) {
      toast.error('Digite um título para o(s) áudio(s)')
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

        // Título específico para este áudio
        // Se houver título gerado pela IA para este arquivo, usar ele
        // Senão, usar título do formulário (se único) ou nome do arquivo (se múltiplos)
        const audioTitle = audioTitles.has(i)
          ? audioTitles.get(i)!
          : files.length > 1 
            ? file.name.replace(/\.[^/.]+$/, '')
            : formData.title

        // 2. Criar recurso no banco
        const { data: resource, error: resourceError } = await supabase
          .from('resources')
          .insert({
            title: audioTitle,
            description: formData.description || null,
            resource_type: 'audio',
            category_id: formData.category_id || null,
            creator_id: creatorId,
            file_url: uploadData.url,
            preview_url: uploadData.previewUrl || null, // Versão com marca d'água
            file_size: file.size,
            file_format: file.name.split('.').pop()?.toLowerCase() || 'mp3',
            duration: durations.get(i) || uploadData.audioMetadata?.duration || null,
            keywords: keywordsArray.length > 0 ? keywordsArray : null,
            is_premium: formData.is_premium,
            is_official: formData.is_official,
            status: userProfile?.is_admin ? 'approved' : 'pending',
          })
          .select()
          .single()

        if (resourceError) throw resourceError

        // 3. Adicionar à coleção se selecionada (apenas o primeiro)
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
          ? `${files.length} áudios enviados com sucesso! Aguardando aprovação.`
          : 'Áudio enviado com sucesso! Aguardando aprovação.'
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
      setAudioPreviews(new Map())
      setDurations(new Map())
      setAudioTitles(new Map())
      setPlayingIndex(null)
      
      // Redirecionar após 1 segundo
      setTimeout(() => {
        router.push('/creator/resources')
      }, 1000)
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Erro ao fazer upload do(s) áudio(s)')
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

  function formatTime(seconds: number | null) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">Upload de Áudio</h1>
        <p className="text-gray-400 font-medium text-sm tracking-wider">
          Envie seus áudios para a comunidade BrasilPSD
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload do Arquivo */}
        <Card className="p-8">
          <div className="flex items-center mb-6">
            <Music className="h-6 w-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              {files.length > 1 ? `Arquivos de Áudio (${files.length})` : 'Arquivo de Áudio'}
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
                  Formatos suportados: MP3, WAV, OGG, M4A, AAC, FLAC, WMA (máx. 50MB cada)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Você pode selecionar múltiplos arquivos
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma"
                onChange={handleFileSelect}
                multiple
              />
            </label>
          ) : (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-3 flex-1">
                      <Music className="h-8 w-8 text-primary-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {file.name.split('.').pop()?.toUpperCase()}
                          {durations.get(index) && ` • ${formatTime(durations.get(index)!)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newFiles = files.filter((_, i) => i !== index)
                        setFiles(newFiles)
                        const newPreviews = new Map(audioPreviews)
                        newPreviews.delete(index)
                        setAudioPreviews(newPreviews)
                        const newDurations = new Map(durations)
                        newDurations.delete(index)
                        setDurations(newDurations)
                        // Limpar títulos - serão regenerados se necessário
                        setAudioTitles(new Map())
                        const audio = audioRefs.current.get(index)
                        if (audio) {
                          audio.pause()
                          audioRefs.current.delete(index)
                        }
                        if (playingIndex === index) {
                          setPlayingIndex(null)
                        }
                        // Se ainda houver arquivos, reprocessar com IA
                        if (newFiles.length > 0) {
                          setTimeout(() => {
                            if (newFiles.length > 1) {
                              processAllAudiosWithAI(newFiles)
                            } else {
                              generateContentWithAI(newFiles[0])
                            }
                          }, 100)
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Preview do Áudio */}
                  {audioPreviews.get(index) && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => togglePlay(index)}
                          className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-500 hover:bg-primary-600 flex items-center justify-center transition-colors"
                        >
                          {playingIndex === index ? (
                            <Pause className="w-5 h-5 text-white" />
                          ) : (
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{files.length > 1 ? file.name.replace(/\.[^/.]+$/, '') : (formData.title || file.name)}</p>
                          <p className="text-xs text-gray-500">
                            {durations.get(index) ? formatTime(durations.get(index)!) : 'Carregando...'}
                          </p>
                        </div>
                      </div>
                      <audio
                        ref={(el) => {
                          if (el) {
                            audioRefs.current.set(index, el)
                          } else {
                            audioRefs.current.delete(index)
                          }
                        }}
                        src={audioPreviews.get(index) || undefined}
                        onPlay={() => setPlayingIndex(index)}
                        onPause={() => {
                          if (playingIndex === index) {
                            setPlayingIndex(null)
                          }
                        }}
                        onEnded={() => {
                          if (playingIndex === index) {
                            setPlayingIndex(null)
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const audio = e.currentTarget
                          setDurations(prev => {
                            const updated = new Map(prev)
                            updated.set(index, Math.round(audio.duration))
                            return updated
                          })
                        }}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Informações Básicas */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tighter">
              Informações do Áudio
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
              <label className="block text-sm font-semibold text-gray-400 tracking-widest mb-2 uppercase">
                Título *
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Efeito Sonoro de Impacto"
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
                placeholder="Descreva o áudio, seu uso, estilo..."
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
                placeholder="Ex: impacto, ação, suspense (separadas por vírgula)"
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
                <p className="text-sm font-semibold text-gray-900">Áudio Premium</p>
                <p className="text-xs text-gray-500">Este áudio requer assinatura premium para download</p>
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
                    Áudio Oficial
                    <ShieldCheck className="h-4 w-4 text-primary-500" />
                  </p>
                  <p className="text-xs text-gray-500">Marcar como áudio oficial do BrasilPSD</p>
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
            {isUploading 
              ? `Enviando... ${Math.round(uploadProgress)}%` 
              : files.length > 1 
                ? `Enviar ${files.length} Áudios`
                : 'Enviar Áudio'}
          </Button>
        </div>
      </form>
    </div>
  )
}


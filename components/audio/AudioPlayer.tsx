'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Heart, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import WaveSurfer from 'wavesurfer.js'

interface AudioPlayerProps {
  audioUrl: string
  previewUrl?: string | null // URL com marca d'água para preview
  title: string
  artist?: string
  duration?: number
  resourceId?: string
  isDownloadable?: boolean
  onDownload?: () => void
  onFavorite?: () => void
  isFavorited?: boolean
  isPlaying?: boolean // Controlado externamente
  onPlayStart?: () => void // Callback quando começa a tocar
  onPlayStop?: () => void // Callback quando para
}

export default function AudioPlayer({
  audioUrl,
  previewUrl,
  title,
  artist,
  duration: initialDuration,
  resourceId,
  isDownloadable = false,
  onDownload,
  onFavorite,
  isFavorited = false,
  isPlaying: externalIsPlaying,
  onPlayStart,
  onPlayStop
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration || 0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const waveformRef = useRef<HTMLDivElement>(null)
  // Usar resourceId ou audioUrl para gerar IDs estáveis (evita hydration mismatch)
  const baseId = resourceId 
    ? resourceId.replace(/-/g, '') 
    : (audioUrl ? audioUrl.slice(-12).replace(/[^a-z0-9]/gi, '') : Math.random().toString(36).substr(2, 9))
  const waveformIdMobile = `waveform-mobile-${baseId}`
  const waveformIdDesktop = `waveform-desktop-${baseId}`
  const wavesurferRef = useRef<ReturnType<typeof WaveSurfer.create> | null>(null)
  const watermarkRef = useRef<HTMLAudioElement | null>(null)
  const isMountedRef = useRef(true)
  const isLoadingUrlRef = useRef(false)
  const hasPersistentErrorRef = useRef(false)
  const lastResourceKeyRef = useRef<string>('')
  const initializationStartedRef = useRef<string>('')

  // Configurar Wavesurfer
  useEffect(() => {
    // Encontrar o container correto baseado no tamanho da tela
    const getContainer = () => {
      if (typeof window === 'undefined') return null
      
      // Determinar qual elemento buscar baseado no tamanho da tela
      const isMobile = window.innerWidth < 768 // md breakpoint do Tailwind
      const targetId = isMobile ? waveformIdMobile : waveformIdDesktop
      
      // Buscar pelo ID correto (mobile ou desktop) - priorizar busca direta por ID
      const containerById = document.getElementById(targetId) as HTMLDivElement | null
      if (containerById && containerById.isConnected) {
        const rect = containerById.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(containerById)
        // Verificar se está visível (display !== 'none') e tem dimensões válidas
        // No mobile, aceitar mesmo se width for 0 (pode estar sendo renderizado)
        const isVisible = computedStyle.display !== 'none'
        const hasDimensions = rect.width >= 0 && rect.height >= 0
        
        if (isVisible && (hasDimensions || isMobile)) {
          waveformRef.current = containerById
          return containerById
        }
      }
      
      // Se não encontrou o elemento correto, tentar o outro (pode estar em transição de tamanho)
      const fallbackId = isMobile ? waveformIdDesktop : waveformIdMobile
      const fallbackContainer = document.getElementById(fallbackId) as HTMLDivElement | null
      if (fallbackContainer && fallbackContainer.isConnected) {
        const rect = fallbackContainer.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(fallbackContainer)
        const isVisible = computedStyle.display !== 'none'
        const hasDimensions = rect.width >= 0 && rect.height >= 0
        
        if (isVisible && (hasDimensions || isMobile)) {
          waveformRef.current = fallbackContainer
          return fallbackContainer
        }
      }
      
      // Tentar usar o ref diretamente se disponível e conectado (fallback)
      if (waveformRef.current && waveformRef.current.isConnected) {
        const rect = waveformRef.current.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(waveformRef.current)
        if (computedStyle.display !== 'none' && (rect.width >= 0 && rect.height >= 0 || isMobile)) {
          return waveformRef.current
        }
      }
      
      // Última tentativa: retornar qualquer elemento conectado pelo ID
      if (containerById && containerById.isConnected) {
        waveformRef.current = containerById
        return containerById
      }
      
      return null
    }
    
    // Função para inicializar o Wavesurfer
    const initializeWavesurfer = () => {
      const currentContainer = waveformRef.current
      if (!currentContainer) return

      // Criar uma chave única para este recurso PRIMEIRO
      const currentResourceKey = `${resourceId || ''}-${audioUrl}-${previewUrl || ''}`
    
    // Se o recurso mudou, resetar o erro persistente e o loading state
    if (currentResourceKey !== lastResourceKeyRef.current) {
      hasPersistentErrorRef.current = false
      isLoadingUrlRef.current = false
      initializationStartedRef.current = ''
      lastResourceKeyRef.current = currentResourceKey
    }
    
    // VERIFICAR ERRO PERSISTENTE ANTES DE QUALQUER OUTRA COISA
    // Se já houve erro persistente para este recurso, não tentar novamente
    if (hasPersistentErrorRef.current && currentResourceKey === lastResourceKeyRef.current) {
      setIsLoading(false)
      setIsPlaying(false)
      return
    }
    
    // Se já existe uma instância do Wavesurfer válida para este recurso, não recriar
    if (wavesurferRef.current && !wavesurferRef.current.destroyed && currentResourceKey === lastResourceKeyRef.current) {
      return
    }

    // Prevenir múltiplas inicializações simultâneas (incluindo dupla execução do React Strict Mode)
    if (isLoadingUrlRef.current || initializationStartedRef.current === currentResourceKey) {
      return
    }

    isMountedRef.current = true
    isLoadingUrlRef.current = true
    initializationStartedRef.current = currentResourceKey
    
    // Função para obter URL segura do áudio
    const getSecureAudioUrl = async () => {
      if (!resourceId) {
        console.log('📝 No resourceId, using direct URL:', { previewUrl, audioUrl })
        return previewUrl || audioUrl
      }
      
      // Extrair key do file_url ou preview_url
      let key: string
      const urlToExtract = previewUrl || audioUrl
      
      if (!urlToExtract || !urlToExtract.trim()) {
        console.error('❌ Empty audioUrl and previewUrl:', { resourceId, audioUrl, previewUrl })
        throw new Error('URL do áudio não encontrada')
      }
      
      try {
        const url = new URL(urlToExtract)
        key = url.pathname.substring(1)
      } catch {
        // Se não for uma URL válida, assumir que é a chave direta
        key = urlToExtract
      }
      
      if (!key || !key.trim()) {
        console.error('❌ Invalid key extracted:', { resourceId, urlToExtract, key })
        throw new Error('Chave do arquivo inválida')
      }

      console.log('🔍 Requesting audio stream:', { resourceId, key: key.substring(0, 50) + '...', type: previewUrl ? 'preview' : 'file' })
      
      // Usar API segura para obter URL assinada
      const type = previewUrl ? 'preview' : 'file'
      const response = await fetch(`/api/audio/stream?resourceId=${resourceId}&key=${encodeURIComponent(key)}&type=${type}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        const errorMessage = errorData.error || 'Erro ao obter URL do áudio'
        
        console.error('❌ Audio stream API error:', {
          resourceId,
          status: response.status,
          error: errorMessage,
          key: key.substring(0, 50) + '...'
        })
        
        // Marcar erro persistente para não tentar novamente (especialmente para 403/401/404)
        // Estes erros indicam problemas de autenticação/autorização ou arquivo não encontrado
        if (response.status === 403 || response.status === 401 || response.status === 404) {
          // IMPORTANTE: Só marcar como erro persistente se for o mesmo recurso
          // Isso previne que um erro em um recurso bloqueie outros recursos
          // currentResourceKey está no escopo do useEffect, então está disponível aqui
          hasPersistentErrorRef.current = true
          isLoadingUrlRef.current = false
          initializationStartedRef.current = '' // Reset para permitir nova tentativa se o recurso mudar
          // Retornar null para indicar que não há URL disponível
          return null
        }
        
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      
      // Validar se a URL foi retornada e é válida
      if (!data.url || typeof data.url !== 'string') {
        console.error('❌ Invalid URL returned from API:', { resourceId, data })
        throw new Error('URL inválida retornada pela API')
      }
      
      // Verificar se a URL é válida
      try {
        new URL(data.url)
        console.log('✅ Audio stream URL generated successfully:', { resourceId, urlLength: data.url.length })
      } catch {
        console.error('❌ Invalid URL format:', { resourceId, url: data.url?.substring(0, 100) })
        throw new Error('Formato de URL inválido')
      }
      
      return data.url
    }

    // Carregar URL segura e criar Wavesurfer
    getSecureAudioUrl()
      .then((urlToUse) => {
        // Verificar se ainda está montado ANTES de qualquer coisa
        if (!isMountedRef.current) {
          isLoadingUrlRef.current = false
          initializationStartedRef.current = ''
          return
        }
        
        isLoadingUrlRef.current = false
        initializationStartedRef.current = '' // Reset após sucesso
        
        // Se não há URL (erro persistente), não continuar
        if (!urlToUse) {
          setIsLoading(false)
          setIsPlaying(false)
          return
        }
        
        // Verificar novamente se ainda está montado e se temos uma URL válida
        const container = waveformRef.current
        if (!container || !isMountedRef.current) {
          return
        }
        
        // Verificar se já existe uma instância do Wavesurfer (pode ter sido criada em outra execução)
        if (wavesurferRef.current && !wavesurferRef.current.destroyed) {
          return
        }

        // Validar URL antes de criar Wavesurfer
        if (!urlToUse || !urlToUse.trim()) {
          console.error('❌ Empty or invalid URL:', { resourceId, urlToUse })
          setIsLoading(false)
          setIsPlaying(false)
          return
        }
        
        // Criar instância do Wavesurfer com configurações otimizadas
        const wavesurfer = WaveSurfer.create({
          container: container,
          waveColor: '#d1d5db', // cinza claro para parte não tocada
          progressColor: '#374151', // cinza escuro para parte tocada
          cursorColor: 'transparent',
          barWidth: 2,
          barRadius: 1,
          barGap: 2,
          height: 48,
          normalize: true,
          url: urlToUse,
          interact: true, // Permite clicar na waveform para navegar
          backend: 'WebAudio', // WebAudio é mais confiável e compatível
          mediaControls: false, // Desabilitar controles de mídia nativos
          autoplay: false,
          dragToSeek: true,
          // Otimizações para áudios longos
          splitChannels: false, // Não separar canais (mais rápido)
        })

        wavesurferRef.current = wavesurfer

        // Event listeners
        wavesurfer.on('play', () => {
          if (!isMountedRef.current) return
          setIsPlaying(true)
          setIsLoading(false)
          // Notificar que este áudio começou a tocar
          if (onPlayStart) {
            onPlayStart()
          }
        })

        wavesurfer.on('pause', () => {
          if (!isMountedRef.current) return
          setIsPlaying(false)
          setIsLoading(false)
          // Notificar que este áudio parou
          if (onPlayStop) {
            onPlayStop()
          }
        })

        wavesurfer.on('timeupdate', (currentTime) => {
          if (!isMountedRef.current) return
          setCurrentTime(currentTime)
        })

        wavesurfer.on('ready', () => {
          if (!isMountedRef.current) return
          setDuration(wavesurfer.getDuration())
          setIsLoading(false)
        })

        wavesurfer.on('loading', (progress) => {
          if (!isMountedRef.current) return
          // Manter loading apenas se ainda não estiver pronto
          // Mas permitir que o áudio comece a tocar mesmo durante o carregamento
          if (progress < 100) {
            setIsLoading(true)
          }
        })

        wavesurfer.on('finish', () => {
          if (!isMountedRef.current) return
          setIsPlaying(false)
          setIsLoading(false)
          setCurrentTime(0)
          if (watermarkRef.current) {
            watermarkRef.current.pause()
            watermarkRef.current.currentTime = 0
          }
        })

        wavesurfer.on('error', (error) => {
          // Ignorar erros de abort que são esperados durante cleanup
          if (error?.name === 'AbortError' || 
              error?.message?.includes('aborted') ||
              error?.message?.includes('BodyStreamBuffer was aborted') ||
              error?.message?.includes('NotAllowedError') ||
              error?.message?.includes('NotSupportedError')) {
            // Não mostrar erro para aborts esperados ou erros de autoplay
            return
          }
          
          // Só mostrar erro se o componente ainda estiver montado
          if (!isMountedRef.current) return
          
          console.error('Wavesurfer error:', error)
          setIsLoading(false)
          setIsPlaying(false)
          
          // Não mostrar toast para erros comuns que podem ser resolvidos automaticamente
          // Apenas logar para debug
          if (!error?.message?.includes('network') && 
              !error?.message?.includes('timeout') &&
              !error?.message?.includes('CORS')) {
            // toast.error('Erro ao carregar áudio')
          }
        })

        // Configurar volume inicial
        wavesurfer.setVolume(isMuted ? 0 : volume)
      })
      .catch((error) => {
        // Verificar se ainda está montado
        if (!isMountedRef.current) {
          isLoadingUrlRef.current = false
          initializationStartedRef.current = ''
          return
        }
        
        // Resetar flags de loading
        isLoadingUrlRef.current = false
        initializationStartedRef.current = '' // Reset após erro
        
        // Sempre atualizar o estado de loading, mesmo para erros persistentes
        setIsLoading(false)
        setIsPlaying(false)
        
        // Não mostrar toast para erros de autenticação/autorização (403/401)
        // pois o usuário já deve estar ciente do problema
        // E não tentar novamente se for erro persistente
        if (!hasPersistentErrorRef.current) {
          const errorMessage = error.message || 'Erro ao carregar áudio'
          
          // Só mostrar toast se não for erro de autenticação/autorização ou erro comum
          if (!errorMessage.includes('Não autorizado') && 
              !errorMessage.includes('Assinatura necessária') &&
              !errorMessage.includes('não disponível') &&
              !errorMessage.includes('network') &&
              !errorMessage.includes('timeout') &&
              !errorMessage.includes('CORS') &&
              !errorMessage.includes('Failed to fetch')) {
            // Silenciar erros comuns que podem ser temporários
            console.warn('Audio loading error (silent):', errorMessage)
            // toast.error(errorMessage)
          }
        }
      })
    }
    
    // Tentar encontrar o container e inicializar - versão otimizada
    let timeoutId: NodeJS.Timeout | null = null
    let retryCount = 0
    // Aumentar tentativas no mobile para dar mais tempo de renderização
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const maxRetries = isMobile ? 8 : 3 // Mais tentativas no mobile (8 tentativas)
    
    const tryInitialize = () => {
      const container = getContainer()
      
      if (container && container.isConnected) {
        // Verificar dimensões básicas (ser mais tolerante no mobile)
        const rect = container.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(container)
        const isVisible = computedStyle.display !== 'none'
        
        // No mobile, aceitar mesmo se width for 0 inicialmente (pode estar sendo renderizado)
        const hasValidDimensions = rect.width > 0 && rect.height > 0
        const isMobileView = window.innerWidth < 768
        
        // Log para debug no mobile
        if (isMobileView && retryCount < 3) {
          console.log('🔍 Mobile container check:', {
            resourceId,
            containerId: container.id,
            width: rect.width,
            height: rect.height,
            visible: isVisible,
            display: computedStyle.display,
            retryCount
          })
        }
        
        // Aceitar se:
        // 1. Tem dimensões válidas E está visível, OU
        // 2. Está no mobile E já tentou várias vezes (pode estar fora da viewport), OU
        // 3. Já tentou muitas vezes (última tentativa)
        if ((hasValidDimensions && isVisible) || 
            (isMobileView && retryCount >= maxRetries - 2) ||
            (retryCount >= maxRetries - 1)) {
          console.log('✅ Container found, initializing Wavesurfer:', {
            resourceId,
            containerId: container.id,
            width: rect.width,
            height: rect.height,
            visible: isVisible,
            retryCount,
            isMobile: isMobileView
          })
          initializeWavesurfer()
          return true
        }
      } else {
        // Log quando não encontra o container
        if (retryCount < 3) {
          console.log('⏳ Container not found yet:', {
            resourceId,
            retryCount,
            isMobile: typeof window !== 'undefined' && window.innerWidth < 768
          })
        }
      }
      
      // Se não encontrou ou não está pronto, tentar novamente
      if (retryCount < maxRetries) {
        retryCount++
        // Delay progressivo: 50ms, 100ms, 150ms... (mais rápido no início)
        const delay = Math.min(50 * retryCount, 500) // Max 500ms entre tentativas
        timeoutId = setTimeout(tryInitialize, delay)
      } else {
        // Se esgotou as tentativas, tentar inicializar mesmo assim
        const container = getContainer()
        if (container && container.isConnected) {
          console.warn('⚠️ Max retries reached, initializing anyway:', { 
            resourceId,
            containerId: container.id 
          })
          initializeWavesurfer()
          return true
        } else {
          console.error('❌ Failed to find container after max retries:', { resourceId })
        }
      }
      return false
    }
    
    // Tentar inicializar imediatamente (sem delay inicial)
    tryInitialize()
    
    // Listener para redimensionamento da janela (mobile/desktop switch)
    let resizeTimeout: NodeJS.Timeout | null = null
    const handleResize = () => {
      // Debounce do resize para evitar muitas chamadas
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        // Se o Wavesurfer já foi inicializado, verificar se precisa reinicializar
        if (wavesurferRef.current && !wavesurferRef.current.destroyed) {
          const currentContainer = waveformRef.current
          const newContainer = getContainer()
          
          // Se o container mudou (mobile <-> desktop), reinicializar
          if (newContainer && currentContainer !== newContainer) {
            console.log('🔄 Screen size changed, reinitializing Wavesurfer:', {
              resourceId,
              oldContainer: currentContainer?.id,
              newContainer: newContainer.id
            })
            
            // Destruir o Wavesurfer atual
            try {
              if (!wavesurferRef.current.destroyed) {
                wavesurferRef.current.destroy()
              }
            } catch (error) {
              console.warn('Error destroying Wavesurfer on resize:', error)
            }
            
            wavesurferRef.current = null
            waveformRef.current = null
            
            // Reinicializar com o novo container
            retryCount = 0
            tryInitialize()
          }
        } else if (!wavesurferRef.current || wavesurferRef.current.destroyed) {
          // Se não foi inicializado ainda, tentar novamente
          retryCount = 0
          tryInitialize()
        }
      }, 300) // Debounce de 300ms
    }
    
    window.addEventListener('resize', handleResize)

    return () => {
      // Limpar timeout se existir
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      
      window.removeEventListener('resize', handleResize)
      
      isMountedRef.current = false
      // Resetar flags de loading apenas se o componente estiver sendo desmontado
      // ou se as dependências mudaram (o que causará uma nova execução do effect)
      isLoadingUrlRef.current = false
      initializationStartedRef.current = ''
      
      // NÃO resetar hasPersistentErrorRef aqui - isso é feito no início do effect
      // quando o recurso muda (currentResourceKey !== lastResourceKeyRef.current)
      
      // Parar o áudio antes de destruir
      try {
        if (wavesurferRef.current && !wavesurferRef.current.destroyed) {
          wavesurferRef.current.pause()
          wavesurferRef.current.destroy()
        }
      } catch (error) {
        // Ignorar erros de destruição silenciosamente
        // (erros de abort são esperados quando o componente é desmontado)
      }
      wavesurferRef.current = null
    }
  }, [audioUrl, previewUrl, resourceId])

  // Atualizar volume quando mudar
  useEffect(() => {
    const wavesurfer = wavesurferRef.current
    if (wavesurfer) {
      wavesurfer.setVolume(isMuted ? 0 : volume)
    }
  }, [volume, isMuted])

  // Sincronizar marca d'água quando não há previewUrl
  useEffect(() => {
    if (previewUrl) {
      // Se houver previewUrl, a marca d'água já está no áudio processado
      if (watermarkRef.current) {
        watermarkRef.current.pause()
        watermarkRef.current.src = ''
      }
      return
    }

    // Criar elemento de áudio de marca d'água
    if (!watermarkRef.current) {
      const watermarkAudio = document.createElement('audio')
      watermarkAudio.src = '/marca dagua audio.mp3'
      watermarkAudio.loop = true
      watermarkAudio.volume = 0.5 // Aumentado de 0.25 para 0.5
      watermarkRef.current = watermarkAudio
      
      // Garantir que o loop está ativo
      watermarkAudio.addEventListener('ended', () => {
        if (watermarkAudio.loop) {
          watermarkAudio.currentTime = 0
          watermarkAudio.play().catch(() => {})
        }
      })
    }

    return () => {
      if (watermarkRef.current) {
        watermarkRef.current.pause()
        watermarkRef.current.src = ''
      }
    }
  }, [previewUrl])

  // Sincronizar marca d'água com o áudio principal
  useEffect(() => {
    if (!previewUrl && watermarkRef.current) {
      if (isPlaying) {
        watermarkRef.current.play().catch(() => {
          // Ignorar erros de autoplay
        })
      } else {
        watermarkRef.current.pause()
      }
    }
  }, [isPlaying, previewUrl])

  const togglePlay = async () => {
    const wavesurfer = wavesurferRef.current
    if (!wavesurfer) return

    try {
      if (wavesurfer.isPlaying()) {
        wavesurfer.pause()
        if (onPlayStop) {
          onPlayStop()
        }
      } else {
        // Notificar que este áudio vai começar a tocar (pausa outros)
        if (onPlayStart) {
          onPlayStart()
        }
        setIsLoading(true)
        await wavesurfer.play()
        if (watermarkRef.current && !previewUrl) {
          watermarkRef.current.play().catch(() => {})
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error)
      toast.error('Erro ao reproduzir áudio')
      setIsLoading(false)
      setIsPlaying(false)
      if (onPlayStop) {
        onPlayStop()
      }
    }
  }
  
  // Sincronizar com estado externo (para pausar quando outro começar)
  useEffect(() => {
    const wavesurfer = wavesurferRef.current
    if (!wavesurfer || wavesurfer.destroyed) return
    
    // Se externalIsPlaying está definido e é false, mas o wavesurfer está tocando, pausar e zerar
    // Isso acontece quando outro áudio começou a tocar
    if (externalIsPlaying !== undefined && !externalIsPlaying && wavesurfer.isPlaying()) {
      wavesurfer.pause()
      wavesurfer.seekTo(0) // Zerar o tempo (voltar para o início)
      setCurrentTime(0)
      setIsPlaying(false)
      if (watermarkRef.current) {
        watermarkRef.current.pause()
        watermarkRef.current.currentTime = 0 // Zerar a marca d'água também
      }
    }
  }, [externalIsPlaying])

  const toggleMute = () => {
    const wavesurfer = wavesurferRef.current
    if (!wavesurfer) return
    
    const newMuted = !isMuted
    setIsMuted(newMuted)
    wavesurfer.setVolume(newMuted ? 0 : volume)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wavesurfer = wavesurferRef.current
    if (!wavesurfer) return
    
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    
    // Se o volume for 0, mutar automaticamente
    if (newVolume === 0) {
      setIsMuted(true)
      wavesurfer.setVolume(0)
    } else if (isMuted) {
      setIsMuted(false)
      wavesurfer.setVolume(newVolume)
    } else {
      wavesurfer.setVolume(newVolume)
    }
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full bg-white rounded-lg border border-gray-100 p-2.5 md:p-4 overflow-hidden">
      {/* Mobile: Layout empilhado */}
      <div className="md:hidden space-y-2">
        {/* Linha 1: Play + Info + Duração */}
        <div className="flex items-center gap-2 min-w-0 w-full">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-3 h-3 text-gray-900" />
            ) : (
              <Play className="w-3 h-3 text-gray-900 ml-0.5" />
            )}
          </button>
          
          <div className="flex-1 min-w-0 overflow-hidden pr-1">
            <div className="text-sm font-semibold text-gray-900 truncate leading-tight">{title}</div>
            {artist && (
              <div className="text-xs text-gray-500 truncate mt-0.5">Por {artist}</div>
            )}
          </div>
          
          <div className="flex-shrink-0 text-xs text-gray-600 font-mono whitespace-nowrap">
            {formatTime(duration)}
          </div>
        </div>

        {/* Linha 2: Waveform - Mobile */}
        <div className="w-full md:hidden overflow-hidden">
          <div
            ref={waveformRef}
            className="w-full h-8 cursor-pointer"
            id={waveformIdMobile}
          />
        </div>

        {/* Linha 3: Ações */}
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              const wavesurfer = wavesurferRef.current
              if (wavesurfer) {
                wavesurfer.seekTo(0)
                setCurrentTime(0)
              }
              if (watermarkRef.current) {
                watermarkRef.current.currentTime = 0
              }
            }}
            className="p-1 text-gray-600 hover:text-gray-900 active:opacity-70"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-1 active:opacity-70 ${
                isFavorited ? 'text-red-500 hover:text-red-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {isDownloadable && onDownload && (
            <button
              onClick={onDownload}
              className="p-1 text-gray-600 hover:text-gray-900 active:opacity-70"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop: Layout horizontal */}
      <div className="hidden md:flex items-center gap-3 md:gap-4 overflow-hidden">
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full border border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 md:w-5 md:h-5 text-gray-900" />
          ) : (
            <Play className="w-4 h-4 md:w-5 md:h-5 text-gray-900 ml-0.5" />
          )}
        </button>

        <div className="flex-shrink-0 min-w-[140px] md:min-w-[180px] max-w-[220px]">
          <div className="text-sm md:text-base font-semibold text-gray-900 truncate leading-tight">{title}</div>
          {artist && (
            <div className="text-xs md:text-sm text-gray-500 truncate mt-0.5">Por {artist}</div>
          )}
        </div>

        <div className="flex-1 min-w-0 mx-2 md:mx-3">
          <div
            ref={waveformRef}
            className="w-full h-12 cursor-pointer"
            id={waveformIdDesktop}
          />
        </div>

        <div className="flex-shrink-0 text-xs md:text-sm text-gray-600 font-mono whitespace-nowrap px-2">
          {formatTime(duration)}
        </div>

        <div className="hidden lg:block flex-shrink-0 text-xs md:text-sm text-gray-400 min-w-[60px] text-center px-2">
          -- BPM
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button
            onClick={() => {
              const wavesurfer = wavesurferRef.current
              if (wavesurfer) {
                wavesurfer.seekTo(0)
                setCurrentTime(0)
              }
              if (watermarkRef.current) {
                watermarkRef.current.currentTime = 0
              }
            }}
            className="p-1.5 md:p-2 text-gray-600 hover:text-gray-900 transition-colors"
            title="Repetir"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-1.5 md:p-2 transition-colors ${
                isFavorited
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Favoritar"
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {isDownloadable && onDownload && (
            <button
              onClick={onDownload}
              className="p-1.5 md:p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

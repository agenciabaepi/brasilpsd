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
  isFavorited = false
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration || 0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const waveformRef = useRef<HTMLDivElement>(null)
  // Usar resourceId ou audioUrl para gerar ID estável (evita hydration mismatch)
  const waveformId = resourceId 
    ? `waveform-${resourceId.replace(/-/g, '')}` 
    : `waveform-${audioUrl ? audioUrl.slice(-12).replace(/[^a-z0-9]/gi, '') : Math.random().toString(36).substr(2, 9)}`
  const wavesurferRef = useRef<ReturnType<typeof WaveSurfer.create> | null>(null)
  const watermarkRef = useRef<HTMLAudioElement | null>(null)
  const isMountedRef = useRef(true)
  const isLoadingUrlRef = useRef(false)
  const hasPersistentErrorRef = useRef(false)
  const lastResourceKeyRef = useRef<string>('')
  const initializationStartedRef = useRef<string>('')

  // Configurar Wavesurfer
  useEffect(() => {
    // Encontrar o container correto - funciona em mobile e desktop
    const getContainer = () => {
      if (typeof window === 'undefined') return null
      
      // Primeiro, tentar usar o ref diretamente se disponível
      if (waveformRef.current && waveformRef.current.isConnected) {
        // Verificar se o elemento está visível (não oculto por CSS)
        const computedStyle = window.getComputedStyle(waveformRef.current)
        const isVisible = computedStyle.display !== 'none'
        
        if (isVisible) {
          const rect = waveformRef.current.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            return waveformRef.current
          }
        }
      }
      
      // Se o ref não está disponível ou não está visível, buscar pelo ID único
      const containerById = document.getElementById(waveformId) as HTMLDivElement | null
      if (containerById && containerById.isConnected) {
        // Verificar se o elemento está visível
        const computedStyle = window.getComputedStyle(containerById)
        const isVisible = computedStyle.display !== 'none'
        
        if (isVisible) {
          const rect = containerById.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            waveformRef.current = containerById
            return containerById
          }
        }
      }
      
      // Última tentativa: retornar o elemento pelo ID mesmo que não esteja visível
      // (pode estar em um layout que ainda não foi renderizado)
      if (containerById && containerById.isConnected) {
        waveformRef.current = containerById
        return containerById
      }
      
      return waveformRef.current
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
      if (!resourceId) return previewUrl || audioUrl
      
      // Extrair key do file_url ou preview_url
      let key: string
      const urlToExtract = previewUrl || audioUrl
      
      try {
        const url = new URL(urlToExtract)
        key = url.pathname.substring(1)
      } catch {
        // Se não for uma URL válida, assumir que é a chave direta
        key = urlToExtract
      }

      // Usar API segura para obter URL assinada
      const type = previewUrl ? 'preview' : 'file'
      const response = await fetch(`/api/audio/stream?resourceId=${resourceId}&key=${encodeURIComponent(key)}&type=${type}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        const errorMessage = errorData.error || 'Erro ao obter URL do áudio'
        
        // Marcar erro persistente para não tentar novamente (especialmente para 403/401)
        // Estes erros indicam problemas de autenticação/autorização que não serão resolvidos
        // apenas tentando novamente com o mesmo recurso
        if (response.status === 403 || response.status === 401) {
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
          backend: 'WebAudio', // Usar WebAudio para melhor performance
          mediaControls: false, // Desabilitar controles de mídia nativos
          autoplay: false,
          dragToSeek: true,
        })

        wavesurferRef.current = wavesurfer

        // Event listeners
        wavesurfer.on('play', () => {
          if (!isMountedRef.current) return
          setIsPlaying(true)
          setIsLoading(false)
        })

        wavesurfer.on('pause', () => {
          if (!isMountedRef.current) return
          setIsPlaying(false)
          setIsLoading(false)
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

        wavesurfer.on('loading', () => {
          if (!isMountedRef.current) return
          setIsLoading(true)
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
              error?.message?.includes('BodyStreamBuffer was aborted')) {
            // Não mostrar erro para aborts esperados (componente desmontado)
            return
          }
          
          // Só mostrar erro se o componente ainda estiver montado
          if (!isMountedRef.current) return
          
          console.error('Wavesurfer error:', error)
          setIsLoading(false)
          setIsPlaying(false)
          toast.error('Erro ao carregar áudio')
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
          
          // Só mostrar toast se não for erro de autenticação/autorização
          if (!errorMessage.includes('Não autorizado') && 
              !errorMessage.includes('Assinatura necessária') &&
              !errorMessage.includes('não disponível')) {
            toast.error(errorMessage)
          }
        }
      })
    }
    
    // Tentar encontrar o container e inicializar - versão otimizada
    let timeoutId: NodeJS.Timeout | null = null
    let retryCount = 0
    const maxRetries = 2 // Apenas 2 tentativas (mais rápido)
    
    const tryInitialize = () => {
      const container = getContainer()
      if (container && container.isConnected) {
        // Verificar se está visível e tem dimensões
        const computedStyle = window.getComputedStyle(container)
        const isVisible = computedStyle.display !== 'none'
        
        if (isVisible) {
          const rect = container.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            // Container encontrado, visível e tem dimensões, inicializar
            initializeWavesurfer()
            return true
          }
        } else {
          // Se não está visível, pode ser que o layout ainda não foi renderizado
          // Tentar novamente com delay maior
          if (retryCount < maxRetries) {
            retryCount++
            const delay = 100 * retryCount // Delay maior para dar tempo do layout renderizar
            timeoutId = setTimeout(tryInitialize, delay)
          }
          return false
        }
      }
      
      // Se não encontrou, tentar novamente com delay curto
      if (retryCount < maxRetries) {
        retryCount++
        // Delay progressivo: 50ms, 100ms, 150ms
        const delay = 50 * retryCount
        timeoutId = setTimeout(tryInitialize, delay)
      }
      return false
    }
    
    // Tentar inicializar imediatamente (sem delay inicial)
    tryInitialize()

    return () => {
      // Limpar timeout se existir
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
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
      } else {
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
    }
  }

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
    <div className="w-full bg-white rounded-lg border border-gray-100 p-3 md:p-4">
      {/* Mobile: Layout empilhado */}
      <div className="md:hidden space-y-3">
        {/* Linha 1: Play + Info + Duração */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 text-gray-900" />
            ) : (
              <Play className="w-4 h-4 text-gray-900 ml-0.5" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
            {artist && (
              <div className="text-xs text-gray-500 truncate">Por {artist}</div>
            )}
          </div>
          
          <div className="flex-shrink-0 text-xs text-gray-600 font-mono">
            {formatTime(duration)}
          </div>
        </div>

        {/* Linha 2: Waveform - Mobile */}
        <div className="w-full md:hidden">
          <div
            ref={waveformRef}
            className="w-full h-10 cursor-pointer"
            id={waveformId}
          />
        </div>

        {/* Linha 3: Ações */}
        <div className="flex items-center justify-end gap-2">
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
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-2 ${
                isFavorited ? 'text-red-500' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {isDownloadable && onDownload && (
            <button
              onClick={onDownload}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <Download className="w-4 h-4" />
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
            id={waveformId}
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

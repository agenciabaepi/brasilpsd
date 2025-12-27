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
  const wavesurferRef = useRef<ReturnType<typeof WaveSurfer.create> | null>(null)
  const watermarkRef = useRef<HTMLAudioElement | null>(null)
  const isMountedRef = useRef(true)

  // Configurar Wavesurfer
  useEffect(() => {
    if (!waveformRef.current) return

    isMountedRef.current = true
    
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
        const error = await response.json()
        throw new Error(error.error || 'Erro ao obter URL do áudio')
      }
      
      const data = await response.json()
      return data.url
    }

    // Carregar URL segura e criar Wavesurfer
    getSecureAudioUrl().then((urlToUse) => {
      if (!waveformRef.current || !isMountedRef.current) return

      // Criar instância do Wavesurfer
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
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
    }).catch((error) => {
      console.error('Error getting secure audio URL:', error)
      if (isMountedRef.current) {
        toast.error('Erro ao carregar áudio')
        setIsLoading(false)
      }
    })

    return () => {
      isMountedRef.current = false
      
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
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        {/* Play Button - Cinza como no Envato */}
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

        {/* Track Info */}
        <div className="flex-shrink-0 min-w-[140px] md:min-w-[180px] max-w-[220px]">
          <div className="text-sm md:text-base font-semibold text-gray-900 truncate leading-tight">{title}</div>
          {artist && (
            <div className="text-xs md:text-sm text-gray-500 truncate mt-0.5">Por {artist}</div>
          )}
        </div>

        {/* Waveform usando Wavesurfer.js */}
        <div className="flex-1 min-w-0 mx-2 md:mx-3">
          <div
            ref={waveformRef}
            className="w-full h-12 cursor-pointer"
          />
        </div>

        {/* Duration */}
        <div className="flex-shrink-0 text-xs md:text-sm text-gray-600 font-mono whitespace-nowrap px-2">
          {formatTime(duration)}
        </div>

        {/* BPM (placeholder) - apenas em telas maiores */}
        <div className="hidden lg:block flex-shrink-0 text-xs md:text-sm text-gray-400 min-w-[60px] text-center px-2">
          -- BPM
        </div>

        {/* Actions */}
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

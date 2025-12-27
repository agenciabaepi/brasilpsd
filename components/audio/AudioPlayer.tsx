'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Heart, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [audioData, setAudioData] = useState<Uint8Array | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const watermarkRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isAudioContextSetupRef = useRef(false)

  // Configurar Web Audio API para análise de espectro (apenas uma vez)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || isAudioContextSetupRef.current) return

    // Criar AudioContext apenas uma vez
    const initAudioContext = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        
        const audioContext = audioContextRef.current
        
        // Retomar contexto se estiver suspenso
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        
        // Criar analisador
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        dataArrayRef.current = dataArray
        analyserRef.current = analyser

        // Conectar áudio ao analisador (CRÍTICO: só pode ser feito UMA vez)
        sourceRef.current = audioContext.createMediaElementSource(audio)
        sourceRef.current.connect(analyser)
        analyser.connect(audioContext.destination)
        
        isAudioContextSetupRef.current = true
      } catch (error) {
        console.error('Error setting up audio analyser:', error)
        // Se der erro, continuar sem visualização mas áudio ainda funciona
        isAudioContextSetupRef.current = true // Marcar como setup para não tentar novamente
      }
    }

    initAudioContext()
  }, []) // Executar apenas uma vez no mount

  // Atualizar visualização quando estiver tocando
  useEffect(() => {
    if (!isPlaying || !analyserRef.current || !dataArrayRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const updateVisualization = () => {
      if (!analyserRef.current || !dataArrayRef.current || !isPlaying) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }

      analyserRef.current.getByteFrequencyData(dataArrayRef.current)
      setAudioData(new Uint8Array(dataArrayRef.current))
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateVisualization)
      }
    }

    updateVisualization()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isPlaying])

  // Configurar áudio de marca d'água (apenas se não houver previewUrl)
  useEffect(() => {
    if (previewUrl) {
      // Se houver previewUrl, a marca d'água já está no áudio processado
      if (watermarkRef.current) {
        watermarkRef.current.pause()
        watermarkRef.current.src = ''
        watermarkRef.current = null
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
    const audio = audioRef.current
    if (!audio) return

    setIsLoading(true)
    try {
      if (isPlaying) {
        audio.pause()
        if (watermarkRef.current) {
          watermarkRef.current.pause()
        }
      } else {
        await audio.play()
      }
    } catch (error) {
      console.error('Error playing audio:', error)
      toast.error('Erro ao reproduzir áudio')
      setIsLoading(false)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !progressRef.current) return

    const rect = progressRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width))
    const newTime = percent * duration

    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    
    const newMuted = !isMuted
    setIsMuted(newMuted)
    audio.muted = newMuted
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    audio.volume = newVolume
    
    // Se o volume for 0, mutar automaticamente
    if (newVolume === 0) {
      setIsMuted(true)
      audio.muted = true
    } else if (isMuted) {
      setIsMuted(false)
      audio.muted = false
    }
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="w-full bg-white rounded-lg border border-gray-100 p-3 md:p-4">
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        {/* Play Button - Verde circular como na imagem */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all disabled:opacity-50 shadow-sm"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 md:w-6 md:h-6 text-white" />
          ) : (
            <Play className="w-5 h-5 md:w-6 md:h-6 text-white ml-0.5" />
          )}
        </button>

        {/* Waveform/Progress Bar */}
        <div className="flex-1 min-w-0">
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="h-12 md:h-14 bg-gray-100 rounded cursor-pointer relative overflow-hidden"
          >
            {/* Waveform real baseado em dados de áudio */}
            <div className="absolute inset-0 flex items-center justify-center gap-[2px] md:gap-[3px] px-2 md:px-3">
              {audioData && audioData.length > 0 ? (
                // Usar dados reais de áudio
                Array.from({ length: Math.min(50, audioData.length) }).map((_, i) => {
                  // Mapear índices para distribuir uniformemente
                  const dataIndex = Math.floor((i / 50) * audioData.length)
                  const value = audioData[dataIndex]
                  // Converter valor (0-255) para altura (25-75%)
                  const barHeight = 25 + (value / 255) * 50
                  const isActive = (i / 50) * 100 < progressPercent
                  return (
                    <div
                      key={i}
                      className={`w-[2px] md:w-[3px] rounded-full transition-all ${
                        isActive ? 'bg-green-600' : 'bg-gray-400'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  )
                })
              ) : (
                // Fallback: barras estáticas quando não há dados
                Array.from({ length: 50 }).map((_, i) => {
                  const isActive = (i / 50) * 100 < progressPercent
                  return (
                    <div
                      key={i}
                      className={`w-[2px] md:w-[3px] rounded-full transition-all ${
                        isActive ? 'bg-green-600' : 'bg-gray-400'
                      }`}
                      style={{ height: '50%' }}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex-shrink-0 text-sm md:text-base text-gray-900 font-medium whitespace-nowrap px-2 md:px-3">
          <span>{formatTime(duration)}</span>
        </div>

        {/* Actions - Colocadas em linha separada abaixo em telas menores, ou ao lado em telas maiores */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-2 transition-colors ${
                isFavorited
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Favoritar"
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {isDownloadable && onDownload && (
            <button
              onClick={onDownload}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Info e controles adicionais em linha separada para telas menores */}
      <div className="mt-3 md:hidden flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-2">
          <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
          {artist && (
            <div className="text-xs text-gray-500 truncate">Por {artist}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-1.5 transition-colors ${
                isFavorited
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          )}
          {isDownloadable && onDownload && (
            <button
              onClick={onDownload}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Track Info - Apenas em telas médias/grandes */}
      <div className="hidden md:block mt-2">
        <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
        {artist && (
          <div className="text-xs text-gray-500 truncate mt-0.5">Por {artist}</div>
        )}
      </div>

      {/* Audio element - precisa estar no DOM para funcionar */}
      <audio 
        ref={audioRef}
        preload="metadata"
        src={previewUrl || audioUrl}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget
          setCurrentTime(audio.currentTime)
        }}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget
          setDuration(audio.duration || 0)
        }}
        onPlay={() => {
          setIsPlaying(true)
          setIsLoading(false)
        }}
        onPause={() => {
          setIsPlaying(false)
          setIsLoading(false)
        }}
        onEnded={() => {
          setIsPlaying(false)
          setIsLoading(false)
          setCurrentTime(0)
        }}
        onCanPlay={() => {
          setIsLoading(false)
        }}
        onPlaying={() => {
          setIsLoading(false)
        }}
        onWaiting={() => {
          setIsLoading(true)
        }}
        onError={(e) => {
          console.error('Audio error:', e)
          setIsLoading(false)
          toast.error('Erro ao carregar áudio')
        }}
      />
    </div>
  )
}

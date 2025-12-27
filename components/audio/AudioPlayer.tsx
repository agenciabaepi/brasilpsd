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
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const watermarkRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Configurar áudio principal - atualizar URL quando mudar
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Usar preview com marca d'água se disponível
    const urlToUse = previewUrl || audioUrl
    if (audio.src !== urlToUse) {
      audio.src = urlToUse
      audio.load()
    }
  }, [audioUrl, previewUrl])

  // Configurar áudio de marca d'água (apenas se não houver previewUrl)
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
      watermarkAudio.volume = 0.25
      watermarkRef.current = watermarkAudio
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
      <div className="flex items-center gap-2 md:gap-3 lg:gap-4 overflow-hidden">
        {/* Play Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full border-2 border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 flex items-center justify-center transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
          ) : (
            <Play className="w-4 h-4 md:w-5 md:h-5 text-gray-700 ml-0.5" />
          )}
        </button>

        {/* Track Info */}
        <div className="flex-shrink-0 min-w-[120px] md:min-w-[160px] lg:min-w-[200px] max-w-[220px]">
          <div className="text-sm md:text-base font-semibold text-gray-900 truncate leading-tight">{title}</div>
          {artist && (
            <div className="text-xs md:text-sm text-gray-500 truncate mt-0.5">Por {artist}</div>
          )}
        </div>

        {/* Waveform/Progress Bar */}
        <div className="flex-1 min-w-0 mx-1 md:mx-2 lg:mx-3">
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="h-10 md:h-11 lg:h-12 bg-gray-100 rounded cursor-pointer relative overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-gradient-to-r from-green-500 to-green-600 transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Simulação de waveform */}
            <div className="absolute inset-0 flex items-center justify-center gap-[1px] md:gap-[2px] px-1.5 md:px-2">
              {Array.from({ length: 50 }).map((_, i) => {
                const barHeight = Math.random() * 60 + 20
                const isActive = (i / 50) * 100 < progressPercent
                return (
                  <div
                    key={i}
                    className={`w-[1.5px] md:w-[2px] rounded-full transition-all ${
                      isActive ? 'bg-white' : 'bg-gray-300'
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex-shrink-0 text-xs md:text-sm text-gray-500 font-mono whitespace-nowrap px-1 md:px-2">
          <span className="hidden sm:inline">{formatTime(currentTime)} / </span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* BPM (placeholder) - apenas em telas maiores */}
        <div className="hidden lg:block flex-shrink-0 text-xs md:text-sm text-gray-400 min-w-[60px] text-center px-1 md:px-2">
          -- BPM
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 md:gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              const audio = audioRef.current
              if (audio) {
                audio.currentTime = 0
                setCurrentTime(0)
              }
              if (watermarkRef.current) {
                watermarkRef.current.currentTime = 0
              }
            }}
            className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Repetir"
          >
            <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-1.5 md:p-2 transition-colors ${
                isFavorited
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Favoritar"
            >
              <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          )}

          {isDownloadable && onDownload && (
            <button
              onClick={onDownload}
              className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}
        </div>

        {/* Volume Control - apenas em telas médias/grandes */}
        <div className="hidden md:flex items-center gap-1.5 md:gap-2 flex-shrink-0 min-w-[80px] max-w-[100px]">
          <button
            onClick={toggleMute}
            className="p-1 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 min-w-0 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
            }}
          />
        </div>
      </div>

      {/* Audio element - precisa estar no DOM para funcionar */}
      <audio 
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => {
          const audio = e.currentTarget
          setCurrentTime(audio.currentTime)
        }}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget
          setDuration(audio.duration || 0)
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
      />
    </div>
  )
}

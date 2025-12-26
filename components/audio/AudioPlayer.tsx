'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Heart, RotateCcw } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
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
  const [showWatermark, setShowWatermark] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const watermarkRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Inicializar áudio principal
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0)
      })
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0)
      })
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
        if (watermarkRef.current) {
          watermarkRef.current.pause()
          watermarkRef.current.currentTime = 0
        }
      })
      audioRef.current.addEventListener('play', () => {
        setIsPlaying(true)
      })
      audioRef.current.addEventListener('pause', () => {
        setIsPlaying(false)
      })
    }

    // Sempre usar o preview com marca d'água se disponível (para reprodução no site)
    // O download sempre será do arquivo original sem marca d'água
    const urlToUse = previewUrl || audioUrl
    if (audioRef.current && audioRef.current.src !== urlToUse) {
      audioRef.current.src = urlToUse
      if (previewUrl) {
        setShowWatermark(true)
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [audioUrl, previewUrl])

  // Inicializar áudio de marca d'água (sobrepor) - apenas se não houver previewUrl
  // Se houver previewUrl, a marca d'água já está no áudio processado
  useEffect(() => {
    // Se não houver previewUrl, usar marca d'água separada
    if (!previewUrl && !watermarkRef.current) {
      watermarkRef.current = new Audio('/marca dagua audio.mp3')
      watermarkRef.current.loop = true
      watermarkRef.current.volume = 0.25 // Volume baixo para não interferir muito
    } else if (previewUrl && watermarkRef.current) {
      // Se houver previewUrl, limpar marca d'água separada
      watermarkRef.current.pause()
      watermarkRef.current.src = ''
      watermarkRef.current = null
    }

    return () => {
      if (watermarkRef.current) {
        watermarkRef.current.pause()
        watermarkRef.current.src = ''
      }
    }
  }, [previewUrl])

  // Sincronizar marca d'água com o áudio principal (apenas se não houver previewUrl)
  useEffect(() => {
    if (isPlaying && !previewUrl && watermarkRef.current) {
      watermarkRef.current.play().catch(() => {
        // Ignorar erros de autoplay
      })
    } else if (!isPlaying && watermarkRef.current) {
      watermarkRef.current.pause()
    }
  }, [isPlaying, previewUrl])

  const togglePlay = async () => {
    if (!audioRef.current) return

    setIsLoading(true)
    try {
      if (isPlaying) {
        audioRef.current.pause()
        if (watermarkRef.current) {
          watermarkRef.current.pause()
        }
      } else {
        await audioRef.current.play()
        if (previewUrl && watermarkRef.current) {
          await watermarkRef.current.play()
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error)
      toast.error('Erro ao reproduzir áudio')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return

    const rect = progressRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    const newTime = percent * duration

    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    const newMuted = !isMuted
    setIsMuted(newMuted)
    audioRef.current.muted = newMuted
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
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
      <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
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
              if (watermarkRef.current) {
                watermarkRef.current.currentTime = 0
              }
              if (audioRef.current) {
                audioRef.current.currentTime = 0
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
        <div className="hidden md:flex items-center gap-1.5 md:gap-2 flex-shrink-0 w-16 md:w-20 lg:w-24">
          <button
            onClick={toggleMute}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
            }}
          />
        </div>
      </div>

      {/* Hidden audio elements */}
      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}


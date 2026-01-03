import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Heart, Sparkles, Crown, Play, Package, Eye } from 'lucide-react'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import { isSystemProfile } from '@/lib/utils/system'
import FontThumbnail from '@/components/fonts/FontThumbnail'
import { useResourceView } from '@/contexts/ResourceViewContext'
import ProtectedImage from '@/components/ui/ProtectedImage'

interface ResourceCardProps {
  resource: Resource
  onFavorite?: (resourceId: string) => void
  isFavorited?: boolean
}

export default function ResourceCard({ resource, onFavorite, isFavorited }: ResourceCardProps) {
  const router = useRouter()
  const [isVideoHovered, setIsVideoHovered] = useState(false)
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null)
  const [isInView, setIsInView] = useState(false)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const [familyCount, setFamilyCount] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Verificar se deve usar modal ou página
  const isAudio = resource.resource_type === 'audio'
  const isFont = resource.resource_type === 'font'
  const useModal = !isAudio && !isFont
  const { openResourceView } = useResourceView()
  
  // Se for oficial ou o creator_id for do sistema, usar o perfil do sistema
  const isOfficial = resource.is_official || isSystemProfile(resource.creator_id)
  const authorName = isOfficial ? (resource.creator?.full_name || 'BrasilPSD') : (resource.creator?.full_name || 'BrasilPSD')
  const canLinkToProfile = !isOfficial && resource.creator_id && !isSystemProfile(resource.creator_id)
  // Motions também são tratados como vídeo (têm preview_url como vídeo)
  const isVideo = resource.resource_type === 'video' || resource.resource_type === 'motion' || resource.file_url?.match(/\.(mp4|webm|mov|avi|mkv)$/i)
  const isMotion = resource.resource_type === 'motion'
  
  // Função helper para obter URL do vídeo correto para exibição
  // Prioriza preview_url (video-previews/) para exibição, usa file_url (resources/) apenas se não houver preview
  const getVideoDisplayUrl = () => {
    if (!isVideo) return null
    
    // Para motions, sempre usar preview_url (que é o vídeo preview sem marca d'água)
    if (isMotion && resource.preview_url) {
      return getS3Url(resource.preview_url)
    }
    
    // Para vídeos normais, priorizar preview_url (preview leve em video-previews/) para exibição
    if (resource.preview_url) {
      return getS3Url(resource.preview_url)
    }
    // Fallback para file_url (MP4 completo em resources/) se não houver preview
    return resource.file_url ? getS3Url(resource.file_url) : null
  }

  // Função helper para obter URL da imagem correta para exibição
  // Para PNGs, sempre usar file_url (original) para preservar transparência
  const getImageDisplayUrl = () => {
    const isPng = resource.file_format?.toLowerCase() === 'png' || resource.resource_type === 'png'
    
    // Para PNGs, sempre usar o arquivo original para preservar transparência
    if (isPng && resource.file_url) {
      return getS3Url(resource.file_url)
    }
    
    // Para outros formatos, usar preview_url ou thumbnail_url como antes
    if (resource.preview_url) {
      return resource.preview_url
    }
    if (resource.thumbnail_url) {
      return resource.thumbnail_url
    }
    return null
  }
  
  // Calcular aspect ratio do vídeo baseado nas dimensões
  const getVideoAspectRatio = () => {
    if (!isVideo || !resource.width || !resource.height) {
      return null // Fallback para aspect-square
    }
    // Usar aspect ratio customizado via style para proporções exatas
    return { aspectRatio: `${resource.width} / ${resource.height}` }
  }
  
  const videoAspectRatioStyle = getVideoAspectRatio()

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (!cardRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            // Carregar vídeo apenas quando estiver visível e próximo (100px antes)
            if (isVideo) {
              // Delay pequeno para não carregar todos os vídeos de uma vez
              setTimeout(() => setShouldLoadVideo(true), 200)
            }
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '100px', // Começar a carregar 100px antes de aparecer
        threshold: 0.01
      }
    )

    observer.observe(cardRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isVideo])

  // Verificar se a fonte pertence a uma família
  useEffect(() => {
    async function checkFamily() {
      if (resource.resource_type === 'font') {
        try {
          const { createSupabaseClient } = await import('@/lib/supabase/client')
          const supabase = createSupabaseClient()
          const familyId = resource.font_family_id || resource.id
          
          const { count } = await supabase
            .from('resources')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')
            .eq('resource_type', 'font')
            .or(`id.eq.${familyId},font_family_id.eq.${familyId}`)
          
          if (count && count > 1) {
            setFamilyCount(count)
          }
        } catch (error) {
          console.error('Error checking font family:', error)
        }
      }
    }
    checkFamily()
  }, [resource.resource_type, resource.font_family_id, resource.id])

  // Cleanup do timeout no unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    if (useModal) {
      e.preventDefault()
      openResourceView(resource.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (useModal && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      openResourceView(resource.id)
    }
  }

  const Component = useModal ? 'div' : Link
  const componentProps = useModal 
    ? { 
        onClick: handleClick, 
        onKeyDown: handleKeyDown,
        role: 'button', 
        tabIndex: 0,
        className: "break-inside-avoid block group w-full h-full cursor-pointer"
      }
    : { 
        href: `/resources/${resource.id}`, 
        className: "break-inside-avoid block group w-full h-full"
      }

  return (
    <Component {...componentProps}>
      <div ref={cardRef} className={`relative overflow-hidden rounded-lg transition-all hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md w-full h-full ${isVideo ? 'bg-black' : 'bg-gray-100'}`}>
        {/* Image/Video Container */}
        <div 
          className={`relative w-full h-full overflow-hidden flex items-center justify-center ${isVideo ? '' : ''}`}
          onMouseEnter={() => {
            // Debounce para evitar múltiplas chamadas rápidas
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
            }
            hoverTimeoutRef.current = setTimeout(() => {
              setIsVideoHovered(true)
              if (videoRef && isVideo && shouldLoadVideo) {
                // Só tentar play se o vídeo já estiver carregado (metadata ou mais)
                if (videoRef.readyState >= 2) {
                  videoRef.play().catch(() => {
                    // Silenciar erros de autoplay
                  })
                }
              }
            }, 100) // Pequeno delay para evitar sobrecarga
          }}
          onMouseLeave={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
            }
            setIsVideoHovered(false)
            if (videoRef && isVideo) {
              videoRef.pause()
              videoRef.currentTime = 0
            }
          }}
        >
          {isVideo && resource.file_url ? (
            <div 
              className={`relative w-full select-none ${!videoAspectRatioStyle ? 'aspect-square' : ''}`}
              style={videoAspectRatioStyle || undefined}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              {/* Preview de vídeo (metade) ou thumbnail - sempre visível quando não está em hover */}
              {resource.thumbnail_url ? (
                // Se thumbnail_url for um vídeo (preview de metade), usar como vídeo
                resource.thumbnail_url.match(/\.(mp4|webm)$/i) ? (
                  <video
                    src={getS3Url(resource.thumbnail_url)}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                      isVideoHovered ? 'opacity-0' : 'opacity-100'
                    }`}
                    muted
                    playsInline
                    loop
                    preload="metadata"
                    controlsList="nodownload"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />
                ) : (
                  // Thumbnail estático (imagem)
                  <Image
                    src={getS3Url(resource.thumbnail_url)}
                    alt={resource.title}
                    width={resource.width || 500}
                    height={resource.height || 500}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                      isVideoHovered ? 'opacity-0' : 'opacity-100'
                    }`}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    priority={false}
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                )
              ) : isInView ? (
                // Fallback: mostrar preview de vídeo ou primeiro frame
                <video
                  src={getVideoDisplayUrl() || ''}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                    isVideoHovered ? 'opacity-0' : 'opacity-100'
                  }`}
                  muted
                  playsInline
                  loop
                  preload="metadata"
                  controlsList="nodownload"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  onLoadedMetadata={(e) => {
                    // Ir para 2 segundos e pausar para usar como thumbnail
                    const video = e.currentTarget
                    if (video.duration >= 2) {
                      video.currentTime = 2
                    } else if (video.duration > 0) {
                      video.currentTime = video.duration * 0.1
                    }
                    video.pause()
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-gray-200 animate-pulse" />
              )}
              {/* Vídeo completo - aparece apenas no hover - carregar apenas quando necessário */}
              {shouldLoadVideo && (
                <video
                  ref={(el) => {
                    setVideoRef(el)
                    if (el && isVideoHovered && el.readyState >= 2) {
                      el.play().catch(() => {})
                    }
                  }}
                  src={getVideoDisplayUrl() || ''}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                    isVideoHovered ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  controlsList="nodownload noplaybackrate nofullscreen"
                  disablePictureInPicture
                  disableRemotePlayback
                  onLoadedMetadata={(e) => {
                    // Quando metadata carregar, se estiver em hover, tentar play
                    if (isVideoHovered) {
                      e.currentTarget.play().catch(() => {})
                    }
                  }}
                  onCanPlay={(e) => {
                    // Quando puder tocar, se estiver em hover, tocar
                    if (isVideoHovered) {
                      e.currentTarget.play().catch(() => {})
                    }
                  }}
                  onAuxClick={(e) => {
                    e.preventDefault()
                    return false
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    return false
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    return false
                  }}
                  onDragStart={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    return false
                  }}
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: isVideoHovered ? 'auto' : 'none'
                  }}
                />
              )}
              {/* Ícone de play - aparece apenas quando não está em hover */}
              {!isVideoHovered && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
                  <div className="bg-white/95 rounded-full p-4 shadow-xl">
                    <Play className="h-8 w-8 text-gray-900 fill-gray-900 ml-1" />
                  </div>
                </div>
              )}
            </div>
          ) : resource.resource_type === 'font' ? (
            // Thumbnail automática para fontes
            <FontThumbnail resource={resource} size="medium" className="w-full" />
          ) : resource.resource_type === 'audio' ? (
            // Áudios - mostrar "SEM PRÉVIA" se não houver thumbnail
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-bold tracking-widest uppercase">
              {resource.thumbnail_url ? (
                <Image
                  src={getS3Url(resource.thumbnail_url)}
                  alt={resource.title}
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  priority={false}
                  loading="lazy"
                />
              ) : (
                'SEM PRÉVIA'
              )}
            </div>
          ) : (() => {
            const imageUrl = getImageDisplayUrl()
            const isPng = resource.file_format?.toLowerCase() === 'png' || resource.resource_type === 'png'
            
            if (imageUrl) {
              return (
                <div 
                  className={`w-full h-full relative ${isPng ? 'bg-checkerboard' : ''}`}
                >
                  <ProtectedImage
                    src={imageUrl}
                    alt={resource.title}
                    width={resource.width || 500}
                    height={resource.height || 500}
                    className="w-full h-full object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    priority={false}
                    loading="lazy"
                    quality={isPng ? 100 : 65} // Máxima qualidade para PNGs
                    objectFit="cover"
                  />
                  {/* Badge de IA - posicionado no canto inferior direito da imagem */}
                  {resource.is_ai_generated && (
                    <div className="absolute bottom-2 right-2 z-20 bg-gray-900/80 backdrop-blur-sm p-1 rounded shadow-lg" title="Gerado por IA">
                      <Image src="/images/icon-ia.png" alt="IA" width={16} height={16} className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )
            }
            return null
          })() || (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs font-bold tracking-widest uppercase">
              Sem prévia
            </div>
          )}
          
          {/* Status Badge (Top Corners) */}
          <div className="absolute top-2 left-2 z-10">
            {resource.is_premium && (
              <div className="bg-gray-900/80 backdrop-blur-sm p-1.5 rounded shadow-lg">
                <Crown className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              </div>
            )}
            {!resource.is_premium && (
              <div className="bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">
                Grátis
              </div>
            )}
          </div>

          <div className="absolute top-2 right-2 z-10 flex gap-1">
            {resource.is_ai_generated && (
              <div className="bg-gray-900/80 backdrop-blur-sm p-1 rounded shadow-sm" title="Gerado por IA">
                <Image src="/images/icon-ia.png" alt="IA" width={16} height={16} className="w-4 h-4" />
              </div>
            )}
            {resource.is_official && (
              <div className="bg-gray-900/80 backdrop-blur-sm p-1 rounded shadow-sm">
                <Image src="/images/verificado.svg" alt="Oficial" width={12} height={12} className="w-3 h-3" />
              </div>
            )}
          </div>

          {resource.is_ai_generated && (
            <div className="absolute bottom-2 left-2 z-10 bg-black/40 backdrop-blur-md text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase">
              <Sparkles className="h-2.5 w-2.5 text-secondary-400" />
              IA Gerada
            </div>
          )}

          {/* Badge de Família de Fontes */}
          {resource.resource_type === 'font' && familyCount && familyCount > 1 && (
            <div className="absolute bottom-2 right-2 z-10 bg-primary-500 text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              <span>Família ({familyCount})</span>
            </div>
          )}

          {/* Minimalist Overlay on hover */}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white drop-shadow-md truncate max-w-[150px] tracking-tight">
                  {resource.title}
                </span>
                {canLinkToProfile ? (
                  <span 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (resource.creator_id) {
                        router.push(`/creator/${resource.creator_id}`);
                      }
                    }}
                    className="text-[10px] font-semibold text-secondary-400 drop-shadow-md flex items-center gap-1.5 tracking-tight mt-0.5 hover:text-secondary-300 transition-colors cursor-pointer"
                  >
                    {authorName}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-secondary-400 drop-shadow-md flex items-center gap-1.5 tracking-tight mt-0.5">
                    {authorName}
                    {isOfficial && (
                      <Image src="/images/verificado.svg" alt="Verificado" width={10} height={10} className="w-2.5 h-2.5" />
                    )}
                  </span>
                )}
              </div>
              <div 
                className="h-8 w-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFavorite?.(resource.id);
                }}
              >
                <Heart className={`h-4 w-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-500'}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ícone de visualizar (só aparece no hover e apenas para recursos que usam modal) */}
      {useModal && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-lg">
            <Eye className="h-6 w-6 text-gray-900" />
          </div>
        </div>
      )}
    </Component>
  )
}

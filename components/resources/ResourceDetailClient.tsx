'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase/client'
import { 
  Download, 
  Heart, 
  Share2, 
  Flag, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  FileText,
  ShieldCheck,
  Sparkles,
  Crown,
  UserPlus,
  Check,
  Grid3x3,
  RefreshCw,
  Package
} from 'lucide-react'
import type { Resource, Profile, Collection } from '@/types/database'
import ResourceCard from '@/components/resources/ResourceCard'
import { formatFileSize } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { getS3Url } from '@/lib/aws/s3'
import JustifiedGrid from '@/components/layout/JustifiedGrid'
import { cn } from '@/lib/utils/cn'
import { isSystemProfileSync } from '@/lib/utils/system'
import FontThumbnail from '@/components/fonts/FontThumbnail'
import AudioPlayer from '@/components/audio/AudioPlayer'
import SubscriptionModal from '@/components/premium/SubscriptionModal'
import ProtectedImage from '@/components/ui/ProtectedImage'

interface ResourceDetailClientProps {
  resource: Resource
  initialUser?: Profile | null
  initialIsFavorited?: boolean
  initialDownloadStatus?: { current: number; limit: number; remaining: number; allowed: boolean } | null
  initialAlreadyDownloadedToday?: boolean
  collection?: Collection | null
  collectionResources?: Resource[]
  relatedResources?: Resource[]
}

export default function ResourceDetailClient({ resource, initialUser, initialIsFavorited = false, initialDownloadStatus = null, initialAlreadyDownloadedToday = false, collection, collectionResources = [], relatedResources = [] }: ResourceDetailClientProps) {
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [downloading, setDownloading] = useState(false)
  const [user, setUser] = useState<Profile | null>(initialUser || null)
  const [isFollowingCreator, setIsFollowingCreator] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false)
  const [videoLoading, setVideoLoading] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<{ current: number; limit: number; remaining: number; allowed: boolean } | null>(initialDownloadStatus)
  const [loadingDownloadStatus, setLoadingDownloadStatus] = useState(false)
  const [alreadyDownloadedToday, setAlreadyDownloadedToday] = useState(initialAlreadyDownloadedToday)
  const [resourceData, setResourceData] = useState(resource)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [fontName, setFontName] = useState<string>('')
  const [familyCount, setFamilyCount] = useState<number | null>(null)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const supabase = createSupabaseClient()

  // Função helper para obter URL da imagem correta para exibição
  // Para PNGs, sempre usar file_url (original) para preservar transparência
  const getImageDisplayUrl = useCallback(() => {
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
  }, [resource.file_format, resource.resource_type, resource.file_url, resource.preview_url, resource.thumbnail_url])

  useEffect(() => {
    // Se já temos initialUser, usar ele e não recarregar (evita flash)
    if (initialUser) {
      setUser(initialUser)
      
      // Apenas verificar se está seguindo o criador
      if (resource.creator_id && initialUser.id !== resource.creator_id) {
        async function checkFollowing() {
          const { data: followData } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', initialUser!.id)
            .eq('creator_id', resource.creator_id)
            .single()
          setIsFollowingCreator(!!followData)
        }
        checkFollowing()
      }
      return
    }

    // Se não temos initialUser, carregar do cliente
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setUser(profile || null)

        // Verificar se está seguindo o criador
        if (resource.creator_id && authUser.id !== resource.creator_id) {
          const { data: followData } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', authUser.id)
            .eq('creator_id', resource.creator_id)
            .single()
          setIsFollowingCreator(!!followData)
        }
      }
    }
    loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.creator_id, initialUser])

  // Carregar fonte para preview (se for fonte)
  useEffect(() => {
    async function loadFont() {
      if (resource.resource_type === 'font' && resource.file_url) {
        try {
          const fontUrl = getS3Url(resource.file_url)
          const fontId = `font-detail-${resource.id.replace(/-/g, '')}`
          
          // Verificar se o estilo já existe
          const existingStyle = document.getElementById(`font-style-${resource.id}`)
          if (existingStyle) {
            setFontName(fontId)
            setFontLoaded(true)
            return
          }
          
          // Criar @font-face dinamicamente
          const style = document.createElement('style')
          style.id = `font-style-${resource.id}`
          
          // Determinar formato da fonte
          const fileFormat = resource.file_format?.toLowerCase() || 'ttf'
          let fontFormat = 'truetype'
          if (fileFormat === 'otf') fontFormat = 'opentype'
          else if (fileFormat === 'woff') fontFormat = 'woff'
          else if (fileFormat === 'woff2') fontFormat = 'woff2'
          
          style.textContent = `
            @font-face {
              font-family: '${fontId}';
              src: url('${fontUrl}') format('${fontFormat}');
              font-display: swap;
            }
          `
          document.head.appendChild(style)
          
          // Aguardar carregamento da fonte
          const font = new FontFace(fontId, `url(${fontUrl})`)
          await font.load()
          document.fonts.add(font)
          
          setFontName(fontId)
          setFontLoaded(true)
        } catch (error) {
          console.error('Error loading font:', error)
          setFontLoaded(false)
        }
      }
    }
    loadFont()
  }, [resource.resource_type, resource.file_url, resource.id])

  // Verificar se a fonte pertence a uma família
  useEffect(() => {
    async function checkFamily() {
      if (resource.resource_type === 'font') {
        try {
          const familyId = (resource as any).font_family_id || resource.id
          
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
  }, [resource.resource_type, resource.id, supabase])

  // Carregar signed URL para vídeo (na página de detalhes, sempre usar file_url completo)
  useEffect(() => {
    async function loadVideoUrl() {
      // Motions também são tratados como vídeo (têm preview_url como vídeo)
      if (resource.resource_type === 'video' || resource.resource_type === 'motion') {
        const isMotion = resource.resource_type === 'motion'
        
        // Para motions, sempre usar preview_url (vídeo preview sem marca d'água)
        // Para vídeos normais, usar file_url (vídeo completo) para o usuário ver o vídeo inteiro antes de baixar
        const videoSourceUrl = isMotion 
          ? resource.preview_url  // Motions: sempre usar preview_url (não usar file_url que é ZIP)
          : resource.file_url || resource.preview_url  // Vídeos: preferir file_url, fallback para preview_url
        
        if (!videoSourceUrl) {
          console.warn('⚠️ No video source URL available', { 
            resource_type: resource.resource_type,
            has_preview: !!resource.preview_url,
            has_file: !!resource.file_url
          })
          setVideoError('Vídeo não disponível.')
          return
        }
        
        console.log('🎥 Loading video URL:', {
          resource_type: resource.resource_type,
          is_motion: isMotion,
          preview_url: resource.preview_url,
          file_url: resource.file_url,
          video_source_url: videoSourceUrl,
          file_format: resource.file_format,
          file_size: resource.file_size
        })
        
        // ESTRATÉGIA: Carregar o vídeo o mais rápido possível
        // 1. Se tiver preview_url, usar imediatamente via proxy (mais leve e rápido)
        // 2. Para vídeos normais (não motions), tentar obter signed URL para o vídeo completo em paralelo
        
        // PRIMEIRO: Para motions, usar signed URL direto (mais rápido que proxy)
        // Para vídeos normais, usar proxy se necessário
        if (resource.preview_url) {
          if (isMotion) {
            // Para motions, obter signed URL via API (mais rápido, sem proxy intermediário)
            console.log('⚡ Fetching signed URL for motion (faster loading)...')
            fetch('/api/video/url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                fileUrl: resource.preview_url || '',
                resourceId: resource.id
              }),
            })
            .then(response => {
              if (response.ok) {
                return response.json()
              }
              throw new Error('Failed to get signed URL')
            })
            .then(data => {
              if (data.url) {
                console.log('✅ Signed URL received for motion preview')
                setVideoUrl(data.url)
                setVideoLoading(true)
                setVideoReady(false)
              } else {
                throw new Error('No URL in response')
              }
            })
            .catch(error => {
              console.warn('⚠️ Failed to get signed URL, falling back to proxy:', error)
              // Fallback para proxy se signed URL falhar
              if (resource.preview_url) {
                const proxyUrl = `/api/video/proxy?fileUrl=${encodeURIComponent(resource.preview_url)}`
                setVideoUrl(proxyUrl)
                setVideoLoading(true)
                setVideoReady(false)
              } else {
                setVideoError('Vídeo não disponível.')
              }
            })
          } else {
            // Para vídeos normais, usar proxy
            const proxyUrl = `/api/video/proxy?fileUrl=${encodeURIComponent(resource.preview_url)}`
            console.log('⚡ Using preview URL via proxy for immediate loading')
            setVideoUrl(proxyUrl)
            setVideoLoading(true)
            setVideoReady(false)
          }
        }
        
        // EM PARALELO: Para vídeos normais (não motions), tentar obter signed URL para o vídeo completo (em background)
        // Motions não precisam disso pois já usam preview_url como fonte principal
        if (!isMotion) {
          supabase.auth.getUser().then(({ data: { user: authUser } }) => {
            if (authUser && resource.file_url) {
              console.log('✅ User authenticated, fetching signed URL for full video...')
              fetch('/api/video/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  fileUrl: resource.file_url,
                  resourceId: resource.id
                }),
              })
              .then(response => {
                if (response.ok) {
                  return response.json()
                }
                throw new Error('Failed to get signed URL')
              })
              .then(data => {
                if (data.url) {
                  console.log('✅ Signed URL received for full video, updating...')
                  // Atualizar para o vídeo completo quando a signed URL estiver pronta
                  setVideoUrl(data.url)
                  setVideoLoading(true)
                  setVideoReady(false)
                }
              })
              .catch(error => {
                console.warn('⚠️ Failed to get signed URL (using preview):', error)
                // Não definir erro se já temos preview_url funcionando
              })
            } else if (!resource.preview_url) {
              console.log('ℹ️ User not authenticated and no preview available')
              setVideoError('Você precisa estar logado para visualizar o vídeo.')
            }
          }).catch(error => {
            console.error('❌ Error checking auth (using preview):', error)
            // Não definir erro se já temos preview_url funcionando
            if (!resource.preview_url) {
              setVideoError('Erro ao carregar vídeo.')
            }
          })
        }
      }
    }
    loadVideoUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.resource_type, resource.preview_url, resource.file_url, supabase])

  // Função para carregar status de downloads (usando useCallback para memoizar)
  const loadDownloadStatus = useCallback(async () => {
    if (!user) {
      setDownloadStatus(null)
      return
    }

    try {
      setLoadingDownloadStatus(true)
      // Adicionar timestamp para evitar cache
      const response = await fetch(`/api/downloads/status?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Download status loaded:', data)
        setDownloadStatus({
          current: data.current || 0,
          limit: data.limit || 0,
          remaining: data.remaining || 0,
          allowed: data.allowed !== undefined ? data.allowed : (data.remaining > 0)
        })
      } else {
        console.error('Error loading download status:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading download status:', error)
    } finally {
      setLoadingDownloadStatus(false)
    }
  }, [user])

  // Buscar status de downloads quando usuário estiver logado (apenas se não foi passado inicialmente)
  useEffect(() => {
    // Se já temos o status inicial do servidor, não precisa buscar novamente
    if (initialDownloadStatus) {
      return
    }

    // Se não tiver initialDownloadStatus, carregar do servidor
    if (!initialDownloadStatus) {
      loadDownloadStatus()
    }

    // Função para verificar se já foi baixado hoje
    async function checkAlreadyDownloadedToday() {
      if (!user) return
      
      try {
        const { data: checkResult } = await supabase
          .rpc('has_user_downloaded_resource_today', {
            p_user_id: user.id,
            p_resource_id: resource.id
          })
        setAlreadyDownloadedToday(Boolean(checkResult))
      } catch (error) {
        console.error('Error checking if already downloaded today:', error)
      }
    }
    
    // Verificar se já foi baixado hoje quando usuário carregar
    if (user && !initialAlreadyDownloadedToday) {
      checkAlreadyDownloadedToday()
    }

    // Listener para atualizar após download
    const handleDownloadCompleted = () => {
      // Aguardar um pouco mais para garantir que o banco foi atualizado
      setTimeout(() => {
        console.log('🔄 Refreshing download status after download...')
        loadDownloadStatus()
        checkAlreadyDownloadedToday()
      }, 1000) // Aumentado para 1 segundo para garantir atualização
    }

    // Listener para atualizar quando download é bloqueado
    const handleDownloadBlocked = () => {
      setTimeout(() => {
        loadDownloadStatus()
        checkAlreadyDownloadedToday()
      }, 500)
    }

    window.addEventListener('download-completed', handleDownloadCompleted)
    window.addEventListener('download-blocked', handleDownloadBlocked)
    return () => {
      window.removeEventListener('download-completed', handleDownloadCompleted)
      window.removeEventListener('download-blocked', handleDownloadBlocked)
    }
  }, [user, initialDownloadStatus, initialAlreadyDownloadedToday, resource.id, loadDownloadStatus, supabase])

  // Função para extrair metadados de vídeos antigos
  async function handleExtractMetadata() {
    if (!user) {
      toast.error('Você precisa estar logado')
      return
    }

    const isCreator = resourceData.creator_id === user.id
    const isAdmin = user.is_admin || false

    if (!isCreator && !isAdmin) {
      toast.error('Apenas o criador ou administrador pode extrair metadados')
      return
    }

    setIsExtractingMetadata(true)
    try {
      const response = await fetch(`/api/resources/${resourceData.id}/extract-metadata`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao extrair metadados')
      }

      // Atualizar dados do recurso
      setResourceData(prev => ({
        ...prev,
        width: data.metadata.width,
        height: data.metadata.height,
        duration: data.metadata.duration || prev.duration,
        frame_rate: data.metadata.frameRate || prev.frame_rate,
      }))

      toast.success('Metadados extraídos com sucesso!')
    } catch (error: any) {
      console.error('Error extracting metadata:', error)
      toast.error(error.message || 'Erro ao extrair metadados')
    } finally {
      setIsExtractingMetadata(false)
    }
  }

  // Se for oficial ou o creator_id for do sistema, usar o perfil do sistema
  const isOfficial = resourceData.is_official || isSystemProfileSync(resourceData.creator_id)
  const authorName = isOfficial ? (resourceData.creator?.full_name || 'BrasilPSD') : (resourceData.creator?.full_name || 'BrasilPSD')
  
         // Calcular aspect ratio do vídeo baseado nas dimensões
         const getVideoAspectRatio = () => {
           if ((resourceData.resource_type !== 'video' && resourceData.resource_type !== 'motion') || !resourceData.width || !resourceData.height) {
             return null // Usar aspect-video padrão
           }
           return { aspectRatio: `${resourceData.width} / ${resourceData.height}` }
         }
         
         const videoAspectRatioStyle = getVideoAspectRatio()
         
         // Detectar se é vídeo vertical (height > width)
         const isVerticalVideo = (resourceData.resource_type === 'video' || resourceData.resource_type === 'motion') && 
           resourceData.width && 
           resourceData.height && 
           resourceData.height > resourceData.width
         
         // Tamanho máximo para vídeos verticais (aumentado para melhor visualização)
         const maxVideoHeight = isVerticalVideo ? '700px' : '600px'

  async function handleFavorite() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Você precisa estar logado')
      return
    }

    if (isFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resource.id)

      if (!error) {
        setIsFavorited(false)
        toast.success('Removido dos favoritos')
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          resource_id: resource.id,
        })

      if (!error) {
        setIsFavorited(true)
        toast.success('Adicionado aos favoritos')
      }
    }
  }

  async function handleDownload() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      toast.error('Você precisa estar logado para baixar')
      router.push('/login')
      return
    }

    // Double check premium status on client side
    if (resource.is_premium && !user?.is_premium) {
      toast.error('Este arquivo é exclusivo para membros Premium')
      router.push('/premium')
      return
    }

    setDownloading(true)

    try {
      const url = new URL(resource.file_url)
      const key = url.pathname.substring(1)

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, key }),
      })
      
      const downloadData = await response.json()

      if (downloadData.error) {
        // Se for erro de assinatura necessária, mostrar modal
        if (response.status === 403 && (
          downloadData.error === 'Assinatura necessária' || 
          downloadData.error === 'Assinatura não encontrada' ||
          downloadData.message?.includes('Premium') ||
          downloadData.message?.includes('assinatura')
        )) {
          setSubscriptionModalOpen(true)
          return
        }
        
        // Se for erro de limite excedido, atualizar o status e mostrar mensagem
        if (response.status === 403 && downloadData.message) {
          // Atualizar status localmente quando limite é excedido
          if (downloadData.current_count !== undefined && downloadData.limit_count !== undefined) {
            setDownloadStatus({
              current: downloadData.current_count,
              limit: downloadData.limit_count,
              remaining: downloadData.remaining || 0,
              allowed: false
            })
          }
          // Disparar evento para recarregar status
          window.dispatchEvent(new CustomEvent('download-blocked'))
          throw new Error(downloadData.message)
        }
        throw new Error(downloadData.error)
      }

      if (!downloadData.url) {
        throw new Error('URL de download não recebida')
      }

      // INICIAR DOWNLOAD IMEDIATAMENTE (antes de qualquer outra operação)
      // Isso faz o download começar instantaneamente enquanto outras operações acontecem em background
      const downloadFileName = resource.title || `download-${resource.id}.${resource.file_format || 'mp4'}`
      
      // Usar download direto para iniciar imediatamente (mais rápido que blob para arquivos grandes)
      const link = document.createElement('a')
      link.href = downloadData.url
      link.download = downloadFileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Mostrar feedback imediato
      toast.success('Download iniciado!')

      // Fazer operações em background (não bloquear o download)
      Promise.all([
        // Incrementar contador do recurso (a API já registrou o download)
        supabase.rpc('increment', {
          table_name: 'resources',
          column_name: 'download_count',
          row_id: resource.id,
        }).catch(err => console.warn('Error incrementing download count:', err)),

        // Atualizar status localmente
        (async () => {
          console.log('📊 Download response data:', {
            current_count: downloadData.current_count,
            limit_count: downloadData.limit_count,
            remaining: downloadData.remaining,
            is_new_download: downloadData.is_new_download
          })
          
          if (downloadData.current_count !== undefined && downloadData.limit_count !== undefined) {
            const newStatus = {
              current: downloadData.current_count,
              limit: downloadData.limit_count,
              remaining: downloadData.remaining || 0,
              allowed: downloadData.remaining > 0
            }
            console.log('✅ Updating download status:', newStatus)
            setDownloadStatus(newStatus)
          } else {
            console.warn('⚠️ Download data missing count info, will refresh from server')
            setTimeout(() => {
              loadDownloadStatus()
            }, 1000)
          }
          
          // Atualizar estado se já foi baixado hoje
          if (downloadData.is_new_download !== undefined) {
            console.log('📝 is_new_download:', downloadData.is_new_download)
            setAlreadyDownloadedToday(!downloadData.is_new_download)
          } else {
            // Se não veio na resposta, verificar novamente
            if (user) {
              try {
                const { data: checkResult } = await supabase
                  .rpc('has_user_downloaded_resource_today', {
                    p_user_id: user.id,
                    p_resource_id: resource.id
                  })
                setAlreadyDownloadedToday(Boolean(checkResult))
              } catch (error) {
                console.error('Error checking if already downloaded:', error)
              }
            }
          }
          
          // Sempre forçar atualização do status após um tempo para garantir sincronização
          setTimeout(() => {
            console.log('🔄 Forcing status refresh after download...')
            loadDownloadStatus()
          }, 2000)
        })()
      ]).catch(err => console.error('Error in background operations:', err))
      
      // Disparar evento para atualizar estatísticas de downloads (para outros componentes)
      window.dispatchEvent(new CustomEvent('download-completed', {
        detail: {
          downloadId: downloadData.download_id,
          currentCount: downloadData.current_count,
          limitCount: downloadData.limit_count,
          remaining: downloadData.remaining
        }
      }))
    } catch (error: any) {
      toast.error(error.message || 'Erro ao baixar recurso')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-8 space-y-8">
          {/* Preview Image/Video/Audio */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center min-h-[400px] group relative shadow-sm">
            {resource.resource_type === 'audio' ? (
              <div className="w-full p-8 md:p-12">
                <AudioPlayer
                  audioUrl={resource.file_url}
                  previewUrl={resource.preview_url}
                  title={resource.title}
                  artist={isOfficial ? 'BrasilPSD' : (resource.creator?.full_name || 'Desconhecido')}
                  duration={resource.duration || undefined}
                  resourceId={resource.id}
                  isDownloadable={true}
                  onDownload={handleDownload}
                  onFavorite={handleFavorite}
                  isFavorited={isFavorited}
                />
              </div>
            ) : (resource.resource_type === 'video' || resource.resource_type === 'motion') ? (
              <div 
                className={`w-full bg-white flex items-center justify-center relative select-none ${!videoAspectRatioStyle ? 'aspect-video' : ''}`}
                style={{
                  ...(videoAspectRatioStyle || {}),
                  maxHeight: (resourceData.width && resourceData.height && resourceData.height > resourceData.width) ? '700px' : '600px',
                  margin: '0 auto'
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
              >
                {/* Overlay de proteção invisível - bloqueia interações indesejadas */}
                <div 
                  className="absolute inset-0 z-30"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    return false
                  }}
                  style={{ 
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none'
                  }}
                />
                {videoUrl ? (
                  <video
                    key={videoUrl} // Force re-render when URL changes
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain relative z-20"
                    preload="metadata"
                    crossOrigin="anonymous"
                    playsInline
                    muted={false}
                    loop={false}
                    controlsList="nodownload noplaybackrate nofullscreen"
                    disablePictureInPicture
                    disableRemotePlayback
                    onAuxClick={(e) => {
                      // Bloquear clique com botão do meio
                      e.preventDefault()
                      return false
                    }}
                    onDoubleClick={(e) => {
                      // Bloquear double-click para fullscreen
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
                      pointerEvents: 'auto',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      maxHeight: (resourceData.width && resourceData.height && resourceData.height > resourceData.width) ? '700px' : '600px',
                      opacity: videoReady ? 1 : (videoUrl ? 1 : 0),
                      transition: 'opacity 0.2s ease-in-out'
                    }}
                    onLoadStart={() => {
                      console.log('🎬 Video load started:', {
                        url: videoUrl?.substring(0, 100),
                        format: resource.file_format,
                        hasSignedUrl: !!videoUrl
                      })
                      setVideoLoading(true)
                      setVideoReady(false)
                    }}
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget
                      console.log('✅ Video metadata loaded:', {
                        duration: video.duration,
                        videoWidth: video.videoWidth,
                        videoHeight: video.videoHeight,
                        readyState: video.readyState,
                        networkState: video.networkState
                      })
                      // Para motions, não pular para 2 segundos - deixar no início para preview rápido
                      // Apenas para vídeos normais, pular para 2 segundos
                      if (resource.resource_type === 'video' && video.duration >= 2) {
                        video.currentTime = 2
                      }
                    }}
                    onCanPlay={() => {
                      console.log('✅ Video can play')
                      setVideoLoading(false)
                      setVideoReady(true)
                    }}
                    onCanPlayThrough={() => {
                      console.log('✅ Video can play through')
                      setVideoLoading(false)
                      setVideoReady(true)
                    }}
                    onWaiting={() => {
                      console.log('⏳ Video waiting for data...')
                      setVideoLoading(true)
                    }}
                    onPlaying={() => {
                      setVideoLoading(false)
                      setVideoReady(true)
                    }}
                    onStalled={() => {
                      console.warn('⚠️ Video stalled')
                      setVideoLoading(true)
                    }}
                    onError={(e) => {
                      const video = e.currentTarget
                      const error = video.error
                      console.error('❌ Video load error:', {
                        error: error,
                        code: error?.code,
                        message: error?.message,
                        src: video.src?.substring(0, 100),
                        networkState: video.networkState,
                        readyState: video.readyState,
                        format: resource.file_format
                      })
                      
                      setVideoLoading(false)
                      
                      // Mensagens de erro específicas
                      let errorMessage = 'Erro ao carregar vídeo'
                      if (error?.code === 4) {
                        // Detectar formato real pela URL (arquivo pode ter sido convertido para MP4)
                        const urlToCheck = resource.preview_url || resource.file_url || ''
                        const actualFormat = urlToCheck.match(/\.(mp4|mov|webm|avi|mkv)$/i)?.[1]?.toUpperCase() || resource.file_format?.toUpperCase() || 'Desconhecido'
                        errorMessage = `Formato ${actualFormat} não é suportado por este navegador. Tente usar Chrome ou Firefox.`
                        setVideoError(errorMessage)
                      } else if (error?.code === 2) {
                        errorMessage = 'Erro de rede ao carregar vídeo. Verifique sua conexão.'
                        setVideoError(errorMessage)
                      } else if (error?.code === 3) {
                        errorMessage = 'Erro ao decodificar vídeo. O arquivo pode estar corrompido.'
                        setVideoError(errorMessage)
                      } else {
                        setVideoError(errorMessage)
                      }
                      
                      // NÃO usar URL direta - sempre requerer signed URL para segurança
                      console.error('❌ Video signed URL failed, not using direct URL for security')
                      setVideoError('Erro ao carregar vídeo. Tente recarregar a página.')
                    }}
                  >
                    Seu navegador não suporta a tag de vídeo.
                  </video>
                ) : (
                  // Fallback: mostrar mensagem enquanto carrega ou se não houver URL
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
                      <p>Preparando vídeo...</p>
                    </div>
                  </div>
                )}
                {(!videoUrl && !videoError && (resource.resource_type === 'video' || resource.resource_type === 'motion')) && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm bg-white/90 z-30">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
                      <p>Carregando vídeo...</p>
                    </div>
                  </div>
                )}
                {videoLoading && videoUrl && !videoReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm bg-white/70 z-30 pointer-events-none">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
                      <p>Preparando vídeo...</p>
                    </div>
                  </div>
                )}
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-sm bg-white/95 p-4 z-30">
                    <div className="text-center max-w-md">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                      <p className="font-semibold mb-2">Erro ao carregar vídeo</p>
                      <p className="text-xs text-gray-600 mb-4">{videoError}</p>
                      <p className="text-xs text-gray-500">
                        {/* Detectar formato real pela URL (arquivo pode ter sido convertido para MP4) */}
                        {(() => {
                          const urlToCheck = resource.preview_url || resource.file_url || ''
                          const actualFormat = urlToCheck.match(/\.(mp4|mov|webm|avi|mkv)$/i)?.[1]?.toUpperCase() || resource.file_format?.toUpperCase() || 'Desconhecido'
                          const isMov = actualFormat.toLowerCase() === 'mov'
                          return (
                            <>
                              Formato: {actualFormat}
                              {isMov && (
                                <span className="block mt-2 text-yellow-400">
                                  💡 Dica: Arquivos MOV podem não funcionar em todos os navegadores. Tente baixar o arquivo diretamente.
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (() => {
              const imageUrl = getImageDisplayUrl()
              const isPng = resource.file_format?.toLowerCase() === 'png' || resource.resource_type === 'png'
              
              if (imageUrl) {
                return (
                  <div className={`w-full flex items-center justify-center min-h-[400px] ${isPng ? 'bg-checkerboard' : 'bg-white'}`}>
                    <div className="relative" style={{ maxWidth: '100%', maxHeight: '600px' }}>
                      <ProtectedImage
                        src={imageUrl}
                        alt={resource.title}
                        width={1200}
                        height={800}
                        priority
                        className="max-w-full max-h-[600px]"
                        quality={isPng ? 100 : 70} // Máxima qualidade para PNGs
                        objectFit="contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                      />
                    </div>
                  </div>
                )
              }
              return null
            })() || resource.resource_type === 'font' ? (
              <FontPreview fontName={fontName} fontLoaded={fontLoaded} resourceTitle={resource.title} />
            ) : (
              <div className="aspect-video w-full flex flex-col items-center justify-center bg-gray-50">
                <FileText className="h-16 w-16 text-gray-200 mb-4" />
                <p className="text-gray-400 font-semibold tracking-widest text-sm uppercase">Sem Prévia</p>
              </div>
            )}
          </div>

          {/* Interaction Bar */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-8">
              <button onClick={handleFavorite} className="flex items-center space-x-2 text-gray-600 hover:text-red-500 transition-colors group">
                <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="text-base font-semibold tracking-tight">{isFavorited ? 'Salvo' : 'Salvar'}</span>
              </button>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-secondary-500 transition-colors group">
                <Share2 className="h-5 w-5" />
                <span className="text-base font-semibold tracking-tight">Compartilhar</span>
              </button>
            </div>
            <button className="text-gray-300 hover:text-gray-600 transition-colors">
              <Flag className="h-5 w-5" />
            </button>
          </div>

          {/* Information Area */}
          <div className="bg-white rounded-2xl p-10 border border-gray-100 space-y-10 shadow-sm">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 tracking-tighter flex items-center">
                <span className="h-6 w-1.5 bg-primary-500 mr-3 rounded-full" />
                Informações Técnicas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-16">
                <div className="space-y-4">
                  {resourceData.resource_type === 'motion' ? (
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Formato do arquivo:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-600 p-0.5">
                          <Image 
                            src="/images/Ae-icone.png" 
                            alt="After Effects" 
                            width={16} 
                            height={16}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-900">
                          Arquivo no formato After Effects editável
                        </span>
                      </div>
                    </div>
                  ) : (
                    <InfoRow label="Formato do arquivo" value={resourceData.file_format?.toUpperCase()} />
                  )}
                  <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                    <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Resolução:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">
                        {resourceData.width && resourceData.height 
                          ? `${resourceData.width} × ${resourceData.height}` 
                          : 'N/A'
                        }
                      </span>
                      {(resourceData.resource_type === 'video' || resourceData.resource_type === 'motion') && (!resourceData.width || !resourceData.height) && user && (resourceData.creator_id === user.id || user.is_admin) && (
                        <button
                          onClick={handleExtractMetadata}
                          disabled={isExtractingMetadata}
                          className="text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Extrair resolução do vídeo"
                        >
                          <RefreshCw className={`h-3 w-3 ${isExtractingMetadata ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                  <InfoRow label="Tamanho" value={formatFileSize(resourceData.file_size)} />
                  <InfoRow label="Licença" value={resourceData.is_premium ? 'Premium' : 'Gratuita'} />
                  {resourceData.is_ai_generated && (
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Origem:</span>
                      <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                        <Sparkles className="h-3 w-3" />
                        IA Gerada
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <InfoRow label="Extensão de download" value="zip" />
                  <InfoRow label="Identificação" value={`#${resourceData.id.substring(0, 8)}`} />
                  {(resourceData.resource_type === 'video' || resourceData.resource_type === 'audio' || resourceData.resource_type === 'motion') && resourceData.duration && (
                    <InfoRow 
                      label="Duração" 
                      value={formatDuration(resourceData.duration)} 
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Atributos de Vídeo */}
            {(resourceData.resource_type === 'video' || resourceData.resource_type === 'motion') && (
              <div className="pt-10 border-t border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tighter flex items-center mb-6">
                  <span className="h-6 w-1.5 bg-primary-500 mr-3 rounded-full" />
                  Atributos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-16">
                  <div className="space-y-4">
                    {resourceData.frame_rate !== null && resourceData.frame_rate !== undefined && (
                      <InfoRow 
                        label="Taxa de Quadros" 
                        value={`${Number(resourceData.frame_rate).toFixed(2)} fps`} 
                      />
                    )}
                    {resourceData.video_encoding && (
                      <InfoRow 
                        label="Codec / Codificação" 
                        value={resourceData.video_encoding} 
                      />
                    )}
                    {resourceData.video_audio_codec && (
                      <InfoRow 
                        label="Codec de Áudio" 
                        value={resourceData.video_audio_codec.toUpperCase()} 
                      />
                    )}
                    {resourceData.video_color_space && (
                      <InfoRow 
                        label="Espaço de Cor" 
                        value={resourceData.video_color_space.toUpperCase()} 
                      />
                    )}
                    {resourceData.video_has_timecode && (
                      <InfoRow 
                        label="Timecode" 
                        value="Sim" 
                      />
                    )}
                    {resourceData.orientation && (
                      <InfoRow 
                        label="Orientação" 
                        value={resourceData.orientation} 
                      />
                    )}
                  </div>
                  <div className="space-y-4">
                    <InfoRow 
                      label="Canal Alfa" 
                      value={resourceData.has_alpha_channel === true ? 'Sim' : 'Não'} 
                    />
                    <InfoRow 
                      label="Com loop" 
                      value={resourceData.has_loop === true ? 'Sim' : 'Não'} 
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-10 border-t border-gray-100">
              <p className="text-gray-700 leading-relaxed text-base font-medium">
                {resource.description || 'Este recurso digital foi projetado para oferecer a máxima qualidade e facilidade de uso em seus projetos criativos. Ideal para designers que buscam agilidade e profissionalismo.'}
              </p>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (SIDEBAR) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-3xl p-10 border border-gray-100 sticky top-24 shadow-sm">
            {/* Header Sidebar */}
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight tracking-tighter">
                    {resource.title}
                  </h1>
                  {resource.is_premium && (
                    <span className="bg-gray-900 text-yellow-400 p-2 rounded-full flex-shrink-0 shadow-lg border border-gray-800">
                      <Crown className="h-5 w-5 fill-yellow-400" />
                    </span>
                  )}
                </div>
            </div>

            {/* Badge de Família (se aplicável) */}
            {resource.resource_type === 'font' && familyCount && familyCount > 1 && (
              <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-500 p-2 rounded-lg">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">Família Completa</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Esta fonte faz parte de uma família com {familyCount} variações. Baixe todas juntas!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="space-y-4 py-6 border-y border-gray-50">
              <CheckItem text={`Arquivo ${resource.file_format?.toUpperCase()} totalmente editável`} />
              <CheckItem text="Uso comercial e pessoal liberado" />
              <CheckItem text="Não exige atribuição de créditos" />
              <CheckItem text="Qualidade premium verificada" />
              <CheckItem text="Acesso imediato após confirmação" />
            </div>

            {/* Premium Highlight */}
            {resource.is_premium && (
              <div className="bg-primary-50/50 rounded-2xl p-6 border border-primary-100 flex items-start space-x-4 my-8">
                <AlertCircle className="h-6 w-6 text-secondary-600 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 tracking-tighter">Recurso Assinante</p>
                  <p className="text-sm text-gray-700 font-bold leading-relaxed tracking-tight">
                    Disponível apenas para membros premium. Faça o upgrade agora!
                  </p>
                </div>
              </div>
            )}

            {/* Download Button */}
            {!user ? (
              <Link href={resource.is_premium ? "/premium" : "/signup"} className="block mt-8">
                <button
                  className={cn(
                    "w-full h-16 rounded-2xl flex items-center justify-center px-6 space-x-3 font-bold text-sm tracking-widest transition-all shadow-lg uppercase",
                    resource.is_premium 
                      ? "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20" 
                      : "bg-gray-900 hover:bg-black text-white shadow-gray-900/20"
                  )}
                >
                  {resource.is_premium ? (
                    <>
                      <Crown className="h-5 w-5 flex-shrink-0" />
                      <span>Assinar Premium para Baixar</span>
                    </>
                  ) : (
                    <>
                      <User className="h-5 w-5 flex-shrink-0" />
                      <span>Crie uma conta para Baixar</span>
                    </>
                  )}
                </button>
              </Link>
            ) : resource.is_premium && !user.is_premium ? (
              <Link href="/premium" className="block mt-8">
                <button className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center px-6 space-x-3 font-bold text-sm tracking-widest transition-all shadow-lg shadow-blue-500/20 uppercase">
                  <Crown className="h-5 w-5 flex-shrink-0" />
                  <span>Assinar Premium para Baixar</span>
                </button>
              </Link>
            ) : (
              <div className="mt-8 space-y-3">
                {/* Botão de Download da Família (se aplicável) */}
                {resource.resource_type === 'font' && familyCount && familyCount > 1 && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      const { data: { user: authUser } } = await supabase.auth.getUser()
                      if (!authUser) {
                        toast.error('Você precisa estar logado para baixar')
                        router.push('/login')
                        return
                      }

                      setDownloading(true)
                      try {
                        toast.loading('Criando arquivo ZIP com a família completa...', { id: 'download-family' })

                        const response = await fetch('/api/download/family', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ resourceId: resource.id }),
                        })

                        if (!response.ok) {
                          const errorData = await response.json()
                          throw new Error(errorData.message || 'Erro ao baixar família')
                        }

                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        
                        const contentDisposition = response.headers.get('content-disposition')
                        const fileName = contentDisposition 
                          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'font-family.zip'
                          : 'font-family.zip'
                        
                        link.download = fileName
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        window.URL.revokeObjectURL(url)

                        toast.success('Família completa baixada com sucesso!', { id: 'download-family' })
                      } catch (error: any) {
                        console.error('Error downloading font family:', error)
                        toast.error(error.message || 'Erro ao baixar família de fontes', { id: 'download-family' })
                      } finally {
                        setDownloading(false)
                      }
                    }}
                    disabled={downloading || (downloadStatus && !downloadStatus.allowed)}
                    className={cn(
                      "w-full h-16 rounded-2xl flex items-center justify-center space-x-3 font-semibold text-sm tracking-widest transition-all disabled:opacity-50 group shadow-lg",
                      downloadStatus && !downloadStatus.allowed
                        ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed shadow-gray-400/20"
                        : "bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/20"
                    )}
                  >
                    <Package className="h-5 w-5" />
                    <span>
                      {downloading 
                        ? 'Baixando...' 
                        : `Baixar Família Completa (${familyCount} fontes)`
                      }
                    </span>
                  </button>
                )}
                
                <button
                  onClick={handleDownload}
                  disabled={downloading || (downloadStatus && !downloadStatus.allowed)}
                  className={cn(
                    "w-full h-16 rounded-2xl flex items-center justify-center space-x-3 font-semibold text-sm tracking-widest transition-all disabled:opacity-50 group shadow-lg",
                    downloadStatus && !downloadStatus.allowed
                      ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed shadow-gray-400/20"
                      : resource.resource_type === 'font' && familyCount && familyCount > 1
                      ? "bg-gray-100 hover:bg-gray-200 text-gray-900 shadow-gray-100/20"
                      : "bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/20"
                  )}
                  title={downloadStatus && !downloadStatus.allowed ? `Limite de downloads excedido. Você já fez ${downloadStatus.current} de ${downloadStatus.limit} downloads hoje.` : undefined}
                >
                  <Download className={cn(
                    "h-5 w-5 transition-transform",
                    downloadStatus && !downloadStatus.allowed ? "" : "group-hover:translate-y-1"
                  )} />
                  <span>
                    {downloading 
                      ? 'Baixando...' 
                      : downloadStatus && !downloadStatus.allowed
                      ? `Limite Atingido (${downloadStatus.current}/${downloadStatus.limit})`
                      : resource.resource_type === 'font' && familyCount && familyCount > 1
                      ? `Baixar Esta Variação${downloadStatus ? ` (${downloadStatus.remaining} restantes)` : ''}`
                      : downloadStatus
                      ? `Baixar Agora (${downloadStatus.remaining} restantes)`
                      : `Baixar Agora (${formatFileSize(resource.file_size)})`
                    }
                  </span>
                </button>
                
                {/* Mostrar mensagem se já foi baixado hoje */}
                {alreadyDownloadedToday && (
                  <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-primary-900 mb-0.5">
                          Já baixado hoje
                        </p>
                        <p className="text-xs text-primary-700">
                          Você já baixou este arquivo hoje. Pode baixar novamente sem consumir seu limite de downloads.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mostrar contador de downloads se disponível */}
                {downloadStatus && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 font-medium">
                      {downloadStatus.current} / {downloadStatus.limit} downloads hoje
                      {downloadStatus.remaining > 0 && (
                        <span className="text-primary-600 font-semibold"> • {downloadStatus.remaining} restantes</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Author Section */}
            <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8">
              {isOfficial || !resource.creator_id || isSystemProfileSync(resource.creator_id) ? (
                <div className="flex items-center space-x-4 flex-shrink-0">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {resource.creator?.avatar_url ? (
                      <Image 
                        src={resource.creator.avatar_url} 
                        alt={authorName} 
                        width={56} 
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : resource.is_official ? (
                      <Image src="/images/verificado.svg" alt="Verificado" width={32} height={32} />
                    ) : (
                      <User className="h-8 w-8 text-gray-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-base font-bold text-gray-900 truncate">{authorName}</p>
                      {isOfficial && (
                        <Image src="/images/verificado.svg" alt="Oficial" width={14} height={14} className="flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-bold tracking-widest mt-0.5 uppercase">
                      {isOfficial ? 'Equipe Oficial' : 'Criador Verificado'}
                    </p>
                  </div>
                </div>
              ) : (
                <Link 
                  href={`/creator/${resource.creator_id}`}
                  className="flex items-center space-x-4 hover:opacity-80 transition-opacity flex-shrink-0"
                >
                  <div className="h-14 w-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {resource.creator?.avatar_url ? (
                      <Image 
                        src={resource.creator.avatar_url} 
                        alt={authorName} 
                        width={56} 
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-gray-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-base font-bold text-gray-900 truncate">{authorName}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-bold tracking-widest mt-0.5 uppercase">
                      Criador Verificado
                    </p>
                  </div>
                </Link>
              )}
              {!isOfficial && resource.creator_id && !isSystemProfileSync(resource.creator_id) && (
                <button 
                  onClick={async () => {
                    const { data: { user: authUser } } = await supabase.auth.getUser()
                    if (!authUser) {
                      toast.error('Você precisa estar logado para seguir')
                      return
                    }

                    if (isFollowingCreator) {
                      const { error } = await supabase
                        .from('followers')
                        .delete()
                        .eq('follower_id', authUser.id)
                        .eq('creator_id', resource.creator_id)

                      if (!error) {
                        setIsFollowingCreator(false)
                        toast.success('Você deixou de seguir')
                      }
                    } else {
                      const { error } = await supabase
                        .from('followers')
                        .insert({
                          follower_id: authUser.id,
                          creator_id: resource.creator_id,
                        })

                      if (!error) {
                        setIsFollowingCreator(true)
                        toast.success('Você está seguindo este criador')
                      }
                    }
                  }}
                  className={cn(
                    "px-5 py-2.5 text-xs font-bold rounded-xl transition-colors",
                    isFollowingCreator
                      ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      : "bg-gray-900 text-white hover:bg-black"
                  )}
                >
                  {isFollowingCreator ? 'Seguindo' : 'Seguir'}
                </button>
              )}
            </div>

            {/* Collection Section */}
            {collection && collectionResources.length > 0 && (
              <div className="pt-8 border-t border-gray-100 mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 tracking-tighter">
                    Da mesma coleção:
                  </h2>
                  <Link 
                    href={`/collections/${collection.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    Ver coleção
                  </Link>
                </div>
                
                {/* Carrossel horizontal */}
                <div className="relative">
                  <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                    <div className="flex gap-3" style={{ width: 'max-content' }}>
                      {collectionResources.map((collectionResource) => (
                        <Link
                          key={collectionResource.id}
                          href={`/resources/${collectionResource.id}`}
                          className="group block flex-shrink-0"
                          style={{ width: '120px' }}
                        >
                          <div className="relative overflow-hidden rounded-lg bg-gray-100 border border-gray-100 hover:border-primary-200 transition-all duration-300 shadow-sm hover:shadow-md">
                            <div className="relative w-full aspect-square overflow-hidden">
                              {collectionResource.resource_type === 'font' ? (
                                <FontThumbnail resource={collectionResource} size="small" className="w-full h-full" />
                              ) : collectionResource.thumbnail_url ? (
                                <Image
                                  src={getS3Url(collectionResource.thumbnail_url)}
                                  alt={collectionResource.title}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  sizes="120px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <FileText className="h-8 w-8 text-gray-300" />
                                </div>
                              )}
                              {collectionResource.is_premium && (
                                <div className="absolute top-1.5 right-1.5 bg-gray-900/80 backdrop-blur-sm p-1 rounded-md shadow-lg border border-white/10">
                                  <Crown className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arquivos Relacionados */}
      {relatedResources.length > 0 && (
        <div className="mt-12 pt-12 border-t border-gray-100">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
              <span className="h-7 w-1.5 bg-primary-500 mr-3 rounded-full" />
              Arquivos Relacionados
            </h2>
            <p className="text-gray-600 mt-2">Outros recursos que podem interessar você</p>
          </div>

          <JustifiedGrid 
            resources={relatedResources}
            rowHeight={240}
            margin={4}
          />
        </div>
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        resourceTitle={resource.title}
        resourcePreview={
          resource.resource_type === 'audio' ? (
            <AudioPlayer
              audioUrl={resource.file_url}
              previewUrl={resource.preview_url}
              title={resource.title}
              artist={resource.is_official ? 'BrasilPSD' : resource.creator?.full_name || 'Desconhecido'}
              duration={resource.duration || undefined}
              resourceId={resource.id}
              isDownloadable={false}
            />
          ) : resource.thumbnail_url ? (
            <div className="relative w-full h-64 bg-gray-100">
              <Image
                src={resource.thumbnail_url}
                alt={resource.title}
                fill
                className="object-cover"
              />
            </div>
          ) : null
        }
        resourceType={resource.resource_type as 'audio' | 'image' | 'video' | 'font' | 'psd' | 'ai'}
      />
    </div>
  )
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center space-x-3">
      <CheckCircle2 className="h-5 w-5 text-secondary-600 flex-shrink-0" />
      <span className="text-sm font-semibold text-gray-700 tracking-tight uppercase">{text}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
      <span className="text-xs font-semibold text-gray-600 tracking-widest uppercase">{label}:</span>
      <span className="text-sm font-semibold text-gray-900 tracking-tight">{value}</span>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `0:${secs.toString().padStart(2, '0')}`
}

// Componente para preview de fonte com alfabeto completo
function FontPreview({ fontName, fontLoaded, resourceTitle }: { fontName: string; fontLoaded: boolean; resourceTitle: string }) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%&*()[]{}<>?/|\\:;.,-_=+~`\'"'
  
  const fontFamily = fontLoaded && fontName ? `'${fontName}', sans-serif` : 'sans-serif'
  
  return (
    <div className="w-full bg-white p-8 md:p-12">
      {!fontLoaded && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Carregando fonte...</p>
        </div>
      )}
      
      <div className="space-y-8">
        {/* Título da Fonte */}
        <div className="text-center pb-6 border-b border-gray-100">
          <h3 
            style={{ fontFamily }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-2"
          >
            {resourceTitle}
          </h3>
          <p className="text-sm text-gray-500 mt-2">Demonstrativo completo da fonte</p>
        </div>

        {/* Alfabeto Maiúsculo */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">Maiúsculas</h4>
          <div 
            style={{ fontFamily }}
            className="text-3xl md:text-4xl font-normal text-gray-900 leading-relaxed tracking-wide"
          >
            {uppercase.split('').map((letter, i) => (
              <span key={i} className="inline-block mr-1">{letter}</span>
            ))}
          </div>
        </div>

        {/* Alfabeto Minúsculo */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">Minúsculas</h4>
          <div 
            style={{ fontFamily }}
            className="text-3xl md:text-4xl font-normal text-gray-900 leading-relaxed tracking-wide"
          >
            {lowercase.split('').map((letter, i) => (
              <span key={i} className="inline-block mr-1">{letter}</span>
            ))}
          </div>
        </div>

        {/* Números */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">Números</h4>
          <div 
            style={{ fontFamily }}
            className="text-3xl md:text-4xl font-normal text-gray-900 leading-relaxed tracking-wide"
          >
            {numbers.split('').map((num, i) => (
              <span key={i} className="inline-block mr-2">{num}</span>
            ))}
          </div>
        </div>

        {/* Símbolos */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">Símbolos</h4>
          <div 
            style={{ fontFamily }}
            className="text-2xl md:text-3xl font-normal text-gray-900 leading-relaxed tracking-wide"
          >
            {symbols.split('').map((symbol, i) => (
              <span key={i} className="inline-block mr-2">{symbol}</span>
            ))}
          </div>
        </div>

        {/* Frase de Exemplo */}
        <div className="space-y-2 pt-6 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">Exemplo de Texto</h4>
          <div 
            style={{ fontFamily }}
            className="text-xl md:text-2xl font-normal text-gray-900 leading-relaxed"
          >
            <p className="mb-2">The quick brown fox jumps over the lazy dog</p>
            <p className="mb-2">O rápido zorro marrom salta sobre o cão preguiçoso</p>
            <p className="text-gray-600">1234567890</p>
          </div>
        </div>
      </div>
    </div>
  )
}

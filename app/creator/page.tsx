'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Upload, FileCheck, FileX, TrendingUp, DollarSign, Eye, Clock, Files, AlertCircle, Play } from 'lucide-react'
import type { Profile, Resource } from '@/types/database'
import Link from 'next/link'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'

export default function CreatorDashboardPage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalResources: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalDownloads: 0,
    totalViews: 0,
  })
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null

    async function loadData() {
      if (!mounted) return
      
      try {
        setLoading(true)
        setError(null)

        // Timeout de segurança (15 segundos)
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.error('⏱️ Timeout loading dashboard')
            setError('Tempo de carregamento excedido. Tente recarregar a página.')
            setLoading(false)
          }
        }, 15000)

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (!mounted) return
        
        if (authError || !authUser) {
          router.push('/login')
          return
        }

        // Load profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (!mounted) return
        
        if (profileError || !profile || (!profile.is_creator && !profile.is_admin)) {
          router.push('/dashboard')
          return
        }

        setUser(profile)

        // Load resources em paralelo com stats
        const [resourcesResult, statsResult] = await Promise.allSettled([
          supabase
            .from('resources')
            .select('*')
            .eq('creator_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('resources')
            .select('status, download_count, view_count')
            .eq('creator_id', authUser.id)
        ])

        if (!mounted) return

        // Processar recursos
        if (resourcesResult.status === 'fulfilled' && resourcesResult.value.data) {
          setResources(resourcesResult.value.data)
        }

        // Processar stats
        if (statsResult.status === 'fulfilled' && statsResult.value.data) {
          const allResources = statsResult.value.data
          setStats({
            totalResources: allResources.length || 0,
            pending: allResources.filter(r => r.status === 'pending').length || 0,
            approved: allResources.filter(r => r.status === 'approved').length || 0,
            rejected: allResources.filter(r => r.status === 'rejected').length || 0,
            totalDownloads: allResources.reduce((sum, r) => sum + (r.download_count || 0), 0) || 0,
            totalViews: allResources.reduce((sum, r) => sum + (r.view_count || 0), 0) || 0,
          })
        }

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        setLoading(false)
      } catch (err: any) {
        console.error('❌ Error loading dashboard:', err)
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (mounted) {
          setError(err.message || 'Erro ao carregar painel')
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-semibold tracking-widest text-[10px] uppercase">Carregando Painel...</p>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
              >
                Recarregar página
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar painel</h2>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors"
            >
              Recarregar
            </button>
            <button
              onClick={() => router.push('/creator/resources')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Meus Arquivos
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 lg:space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h1 className="text-2xl lg:text-4xl font-semibold text-gray-900 tracking-tight">Painel do Criador</h1>
          <p className="text-xs lg:text-sm text-gray-400 font-medium tracking-wider">Acompanhe seu desempenho e envie novos arquivos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
          <Link href="/creator/upload" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 rounded-2xl px-6 lg:px-8 h-12 lg:h-14 border-none font-semibold tracking-tighter uppercase text-xs lg:text-sm">
              <Upload className="mr-2 lg:mr-3 h-4 w-4 lg:h-5 lg:w-5" />
              Enviar Novo
            </Button>
          </Link>
          <Link href="/creator/upload/batch" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto rounded-2xl px-6 lg:px-8 h-12 lg:h-14 font-semibold tracking-tighter uppercase text-xs lg:text-sm">
              <Upload className="mr-2 lg:mr-3 h-4 w-4 lg:h-5 lg:w-5" />
              Upload em Lote
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <CreatorStatCard title="Arquivos" value={stats.totalResources} icon={Files} color="primary" />
        <CreatorStatCard title="Downloads" value={stats.totalDownloads} icon={TrendingUp} color="primary" />
        <CreatorStatCard title="Pendentes" value={stats.pending} icon={Clock} color="primary" />
        <CreatorStatCard title="Visualizações" value={stats.totalViews} icon={Eye} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none overflow-hidden p-0">
            <div className="px-4 lg:px-8 py-4 lg:py-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 tracking-tight text-xs lg:text-sm">Envios Recentes</h3>
              <Link href="/creator/resources" className="text-[9px] lg:text-[10px] font-semibold text-primary-500 uppercase tracking-widest hover:text-primary-600">Ver Tudo</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {resources.length > 0 ? (
                resources.map((resource) => {
                  const isVideo = resource.resource_type === 'video' || resource.file_url?.match(/\.(mp4|webm|mov|avi|mkv)$/i)
                  const isImagePath = (path: string | null | undefined) => {
                    if (!path) return false
                    const lower = path.toLowerCase()
                    return ['.jpg', '.jpeg', '.png', '.webp', '.avif'].some(ext => lower.endsWith(ext))
                  }
                  const thumbSrc =
                    resource.thumbnail_url
                      ? (resource.thumbnail_url.startsWith('http')
                          ? resource.thumbnail_url
                          : `/api/image/${resource.thumbnail_url}?w=200&q=75`)
                      : (resource.preview_url && isImagePath(resource.preview_url)
                          ? (resource.preview_url.startsWith('http')
                              ? resource.preview_url
                              : `/api/image/${resource.preview_url}?w=200&q=75`)
                          : null)
                  
                  return (
                  <div key={resource.id} className="px-4 lg:px-8 py-4 lg:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors">
                    <div 
                      className="h-12 w-12 lg:h-14 lg:w-14 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden relative"
                      onMouseEnter={() => {
                        if (isVideo) {
                          setHoveredVideoId(resource.id)
                        }
                      }}
                      onMouseLeave={() => {
                        if (isVideo) {
                          setHoveredVideoId(null)
                        }
                      }}
                    >
                      {isVideo && (resource.preview_url || resource.file_url) ? (
                        <>
                          {/* Thumbnail - sempre visível quando não está em hover */}
                          {thumbSrc ? (
                            <Image
                              src={thumbSrc}
                              alt={resource.title}
                              width={56}
                              height={56}
                              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                                hoveredVideoId === resource.id ? 'opacity-0' : 'opacity-100'
                              }`}
                              unoptimized
                            />
                          ) : (
                            <video
                              src={(resource.preview_url ? getS3Url(resource.preview_url) : getS3Url(resource.file_url)) + '#t=0.001'}
                              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                                hoveredVideoId === resource.id ? 'opacity-0' : 'opacity-100'
                              }`}
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedData={(e) => {
                                const dur = e.currentTarget.duration
                                const mid = isFinite(dur) && dur > 0 ? dur / 2 : 0.5
                                e.currentTarget.currentTime = mid
                                e.currentTarget.pause()
                              }}
                              onContextMenu={(e) => e.preventDefault()}
                              onDragStart={(e) => e.preventDefault()}
                              draggable={false}
                            />
                          )}
                          {/* Vídeo - aparece apenas no hover */}
                          <video
                            src={(resource.preview_url ? getS3Url(resource.preview_url) : getS3Url(resource.file_url)) + '#t=0.001'}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                              hoveredVideoId === resource.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                            }`}
                            muted
                            loop
                            playsInline
                            preload="none"
                            controlsList="nodownload noplaybackrate nofullscreen"
                            disablePictureInPicture
                            disableRemotePlayback
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
                              pointerEvents: hoveredVideoId === resource.id ? 'auto' : 'none'
                            }}
                            ref={(video) => {
                              if (video && hoveredVideoId === resource.id) {
                                video.play().catch(() => {})
                              } else if (video && hoveredVideoId !== resource.id) {
                                video.pause()
                                video.currentTime = 0
                              }
                            }}
                          />
                          {hoveredVideoId !== resource.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20 pointer-events-none">
                              <div className="bg-white/90 rounded-full p-1 shadow-lg">
                                <Play className="h-3 w-3 text-gray-900 fill-gray-900 ml-0.5" />
                              </div>
                            </div>
                          )}
                        </>
                      ) : thumbSrc ? (
                        <Image
                          src={thumbSrc}
                          alt={resource.title}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-300">
                          <Files className="h-4 w-4 lg:h-5 lg:w-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs lg:text-sm font-semibold text-gray-900 truncate tracking-tight">{resource.title}</p>
                      <div className="flex items-center flex-wrap gap-2 lg:gap-3 mt-1">
                        <span className={`text-[8px] lg:text-[9px] font-semibold px-2 py-0.5 rounded uppercase ${
                          resource.status === 'approved' ? 'bg-primary-50 text-gray-900' :
                          resource.status === 'pending' ? 'bg-primary-50 text-primary-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {resource.status}
                        </span>
                        <span className="text-[9px] lg:text-[10px] font-medium text-gray-300 tracking-tighter">
                          {new Date(resource.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <p className="text-sm lg:text-base font-semibold text-gray-900 tracking-tighter">{resource.download_count}</p>
                      <p className="text-[8px] lg:text-[9px] font-medium text-gray-400 uppercase tracking-widest">Downloads</p>
                    </div>
                  </div>
                  )
                })
              ) : (
                <div className="p-12 lg:p-20 text-center">
                  <p className="text-gray-300 font-medium uppercase text-[10px] lg:text-xs">Nenhum arquivo enviado</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-900 border-none p-6 lg:p-8 text-white rounded-2xl lg:rounded-[2rem]">
            <h3 className="font-semibold tracking-tight text-lg lg:text-xl mb-3 lg:mb-4 text-primary-500 uppercase">Saldo Atual</h3>
            <p className="text-3xl lg:text-4xl font-semibold tracking-tighter mb-2">R$ 0,00</p>
            <p className="text-gray-500 text-[10px] lg:text-xs font-medium uppercase tracking-widest mb-6 lg:mb-8">Disponível para saque em breve</p>
            <button className="w-full py-3 lg:py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl lg:rounded-2xl font-semibold uppercase text-[10px] lg:text-xs tracking-widest transition-all">
              Configurar Saques
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CreatorStatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    primary: 'bg-primary-50 text-primary-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-primary-50 text-gray-900',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card className="border-none flex items-center space-x-2 lg:space-x-4 p-3 lg:p-6 hover:translate-y-[-2px] lg:hover:translate-y-[-4px] transition-all">
      <div className={`h-8 w-8 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="h-4 w-4 lg:h-6 lg:w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] lg:text-[10px] font-semibold text-gray-400 uppercase tracking-widest truncate">{title}</p>
        <p className="text-lg lg:text-2xl font-semibold text-gray-900 tracking-tighter leading-none mt-0.5 lg:mt-1">{value}</p>
      </div>
    </Card>
  )
}

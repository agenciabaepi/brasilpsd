'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase/client'
import { User, UserPlus, Check, Download, Heart, Eye, MapPin, Calendar, Share2, Bookmark, ChevronDown, Files } from 'lucide-react'
import type { Profile, Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import ResourceCard from '@/components/resources/ResourceCard'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { isSystemProfileSync } from '@/lib/utils/system'
import JustifiedGrid from '@/components/layout/JustifiedGrid'

export default function CreatorProfilePage() {
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const [creator, setCreator] = useState<Profile | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [featuredResources, setFeaturedResources] = useState<Resource[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [likesCount, setLikesCount] = useState(0)
  const [stats, setStats] = useState({
    totalResources: 0,
    totalDownloads: 0,
    totalViews: 0,
  })
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [showFeatured, setShowFeatured] = useState(true)
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (id) {
      loadProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadProfile() {
    if (!id) {
      toast.error('ID do criador não encontrado')
      return
    }

    // Garantir que o ID seja uma string
    const creatorId = typeof id === 'string' ? id : String(id)
    
    setLoading(true)
    try {
      // Carregar usuário atual
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setCurrentUser(profile)
      }

      // Carregar perfil do criador - usar o ID do parâmetro da URL
      // Primeiro tenta buscar como criador
      let { data: creatorData, error: creatorError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .eq('is_creator', true)
        .single()

      // Se não encontrar como criador, busca qualquer perfil (pode ser um usuário que ainda não virou criador)
      if (creatorError || !creatorData) {
        const { data: regularUser, error: regularError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', creatorId)
          .single()
        
        if (regularError || !regularUser) {
          // Não mostrar toast aqui, apenas definir loading como false e deixar a UI mostrar a mensagem
          setLoading(false)
          return
        }
        
        creatorData = regularUser
        creatorError = null
      }

      if (!creatorData) {
        setLoading(false)
        return
      }

      setCreator(creatorData)

      // Verificar se está seguindo
      if (authUser && authUser.id !== creatorId) {
        const { data: followData } = await supabase
          .from('followers')
          .select('id')
          .eq('follower_id', authUser.id)
          .eq('creator_id', creatorId)
          .single()
        setIsFollowing(!!followData)
      }

      // Contar seguidores
      const { count: followers } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
      setFollowersCount(followers || 0)

      // Contar curtidas (soma de todos os likes dos recursos)
      const { data: allResources } = await supabase
        .from('resources')
        .select('like_count')
        .eq('creator_id', creatorId)
        .eq('status', 'approved')
      
      const totalLikes = allResources?.reduce((sum, r) => sum + (r.like_count || 0), 0) || 0
      setLikesCount(totalLikes)

      // Determinar se deve mostrar todos os recursos ou apenas aprovados
      const isOwnProfile = authUser && authUser.id === creatorId
      
      // Carregar recursos em destaque (mais baixados)
      try {
        let featuredQuery = supabase
          .from('resources')
          .select('*, creator:profiles!creator_id(*), category:categories!category_id(*)')
          .eq('creator_id', creatorId)
          .order('download_count', { ascending: false })
          .limit(6)
        
        // Se não for o próprio perfil, mostrar apenas aprovados
        if (!isOwnProfile) {
          featuredQuery = featuredQuery.eq('status', 'approved')
        }
        
        const { data: featuredData, error: featuredError } = await featuredQuery
        
        if (featuredError) {
          console.error('Erro ao carregar recursos em destaque:', featuredError)
          // Não mostrar toast para recursos em destaque, apenas logar o erro
        } else {
          setFeaturedResources(featuredData || [])
        }
      } catch (error) {
        console.error('Erro ao carregar recursos em destaque:', error)
      }

      // Carregar todos os recursos do criador
      let resourcesData: Resource[] | null = null
      try {
        let resourcesQuery = supabase
          .from('resources')
          .select(`
            *,
            creator:profiles!creator_id(*),
            category:categories!category_id(*)
          `)
          .eq('creator_id', creatorId)
          .order('created_at', { ascending: false })
          .limit(100)
        
        // Se não for o próprio perfil, mostrar apenas aprovados
        if (!isOwnProfile) {
          resourcesQuery = resourcesQuery.eq('status', 'approved')
        }
        
        const { data, error: resourcesError } = await resourcesQuery
        
        if (resourcesError) {
          console.error('Erro ao carregar recursos:', {
            code: resourcesError.code,
            message: resourcesError.message,
            details: resourcesError.details,
            hint: resourcesError.hint
          })
          // Só mostrar toast se for um erro inesperado (não é apenas "nenhum resultado")
          if (resourcesError.code !== 'PGRST116') { // PGRST116 = nenhum resultado encontrado
            // Evitar múltiplos toasts - verificar se já foi mostrado
            const errorKey = `resource-error-${creatorId}`
            if (!sessionStorage.getItem(errorKey)) {
              sessionStorage.setItem(errorKey, 'true')
              toast.error('Erro ao carregar recursos do criador')
              setTimeout(() => sessionStorage.removeItem(errorKey), 1000)
            }
          }
          setResources([])
          resourcesData = []
        } else {
          resourcesData = data || []
          setResources(resourcesData)
          console.log(`✅ Carregados ${resourcesData.length} recursos do criador ${creatorId}`)
        }
      } catch (error) {
        console.error('Erro ao carregar recursos:', error)
        toast.error('Erro ao carregar recursos do criador')
        setResources([])
        resourcesData = []
      }

      // Calcular estatísticas (apenas recursos aprovados para estatísticas públicas)
      if (resourcesData) {
        const approvedResources = resourcesData.filter(r => r.status === 'approved')
        const totalDownloads = approvedResources.reduce((sum, r) => sum + (r.download_count || 0), 0)
        const totalViews = approvedResources.reduce((sum, r) => sum + (r.view_count || 0), 0)

        setStats({
          totalResources: approvedResources.length,
          totalDownloads,
          totalViews,
        })
      }
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', {
        message: error?.message,
        code: error?.code,
        details: error?.details
      })
      // Evitar múltiplos toasts - verificar se já foi mostrado
      const errorKey = `profile-error-${id}`
      if (typeof window !== 'undefined' && !sessionStorage.getItem(errorKey)) {
        sessionStorage.setItem(errorKey, 'true')
        // Só mostrar toast se não for um erro de "não encontrado"
        if (error?.code !== 'PGRST116') {
          toast.error('Erro ao carregar perfil')
        }
        setTimeout(() => sessionStorage.removeItem(errorKey), 1000)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleFollow() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Você precisa estar logado para seguir')
      return
    }

    const creatorId = typeof id === 'string' ? id : String(id)
    if (isFollowing) {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('creator_id', creatorId)

      if (!error) {
        setIsFollowing(false)
        setFollowersCount(prev => prev - 1)
        toast.success('Você deixou de seguir')
      }
    } else {
      const { error } = await supabase
        .from('followers')
        .insert({
          follower_id: user.id,
          creator_id: creatorId,
        })

      if (!error) {
        setIsFollowing(true)
        setFollowersCount(prev => prev + 1)
        toast.success('Você está seguindo este criador')
      }
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)} mi`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)} mil`
    }
    return num.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-600"></div>
      </div>
    )
  }

  if (!creator) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 font-semibold">Criador não encontrado</p>
      </div>
    )
  }

  const isSystemProfilePage = isSystemProfileSync(creator.id)
  const isOwnProfile = currentUser?.id === creator.id || (isSystemProfilePage && currentUser?.is_admin)
  const createdDate = creator.created_at ? format(new Date(creator.created_at), "MMMM 'de' yyyy", { locale: ptBR }) : ''

  return (
    <div className="min-h-screen bg-white">
      {/* Banner com preview de recursos */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-b border-gray-800">
        {/* Preview de recursos no background */}
        {resources.length > 0 && (
          <div className="absolute inset-0 opacity-20 overflow-hidden">
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 h-full p-4">
              {resources.slice(0, 16).map((resource, index) => (
                resource.thumbnail_url ? (
                  <div key={resource.id || index} className={`relative aspect-square rounded-lg overflow-hidden ${resource.file_format?.toLowerCase() === 'png' ? 'bg-checkerboard' : 'bg-gray-100'}`}>
                    <Image
                      src={getS3Url(resource.thumbnail_url)}
                      alt={resource.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 25vw, 12.5vw"
                    />
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}
        
        <div className="relative z-10">
          <div className="container mx-auto max-w-7xl px-4 pt-8 pb-12">
            {/* Conteúdo do Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
              {/* Informações do criador */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-6 mb-6">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                      {creator.avatar_url ? (
                        <Image
                          src={creator.avatar_url}
                          alt={creator.full_name || 'Criador'}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center">
                          <User className="h-12 w-12 text-white" />
                        </div>
                      )}
                    </div>
                    {creator.is_creator && (
                      <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full p-1.5 border-4 border-white">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-2 drop-shadow-lg">
                      {creator.full_name || 'Criador Sem Nome'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-white/80 text-sm">
                      {createdDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Desde {createdDate}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>Brasil</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-base sm:text-lg text-white/90 mb-6 max-w-3xl drop-shadow">
                  Bem-vindo ao nosso perfil oficial, aqui você encontra conteúdos criativos que agregam valor aos seus projetos.
                </p>

                {/* Estatísticas */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-white/80">
                  <div className="flex items-center gap-2">
                    <Files className="h-5 w-5" />
                    <span className="text-sm font-medium">{formatNumber(stats.totalResources)} arquivos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    <span className="text-sm font-medium">{formatNumber(stats.totalDownloads)} downloads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    <span className="text-sm font-medium">{formatNumber(likesCount)} curtidas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span className="text-sm font-medium">{formatNumber(followersCount)} seguidores</span>
                  </div>
                </div>
              </div>

              {/* Preview grid dos recursos */}
              {resources.length > 0 && (
                <div className="lg:col-span-1">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {resources.slice(0, 4).map((resource, index) => (
                        resource.thumbnail_url ? (
                          <Link
                            key={resource.id || index}
                            href={`/resources/${resource.id}`}
                            className={`aspect-square relative rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all group ${resource.file_format?.toLowerCase() === 'png' ? 'bg-checkerboard' : 'bg-gray-100'}`}
                          >
                            <Image
                              src={getS3Url(resource.thumbnail_url)}
                              alt={resource.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 1024px) 50vw, 25vw"
                            />
                          </Link>
                        ) : (
                          <div key={index} className="aspect-square rounded-lg bg-white/10 flex items-center justify-center">
                            <span className="text-white/30 text-xs">Sem prévia</span>
                          </div>
                        )
                      ))}
                      {resources.length < 4 && (
                        Array.from({ length: 4 - resources.length }).map((_, i) => (
                          <div key={`empty-${i}`} className="aspect-square rounded-lg bg-white/10" />
                        ))
                      )}
                    </div>
                    {resources.length > 4 && (
                      <p className="text-xs text-white/70 text-center mt-3">
                        +{resources.length - 4} mais recursos
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Ações */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container mx-auto max-w-7xl px-4 py-3 sm:py-4">
          <div className="flex items-center justify-center sm:justify-start">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
              {!isOwnProfile && (
                <button
                  onClick={handleFollow}
                  className={cn(
                    "px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2",
                    isFollowing
                      ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      : "bg-secondary-600 text-white hover:bg-secondary-700"
                  )}
                >
                  {isFollowing ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Seguindo</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Seguir</span>
                    </>
                  )}
                </button>
              )}
              {isOwnProfile && !isSystemProfilePage && (
                <Link
                  href="/creator"
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold text-sm hover:bg-primary-600 transition-all"
                >
                  Meu Painel
                </Link>
              )}
              <button className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
                <Share2 className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
                <Bookmark className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Seção de Destaques */}
        {featuredResources.length > 0 && (
          <div className="mb-12">
            <button
              onClick={() => setShowFeatured(!showFeatured)}
              className="flex items-center justify-between w-full mb-6 group"
            >
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Destaques</h2>
              <ChevronDown className={cn(
                "h-5 w-5 text-gray-600 transition-transform",
                showFeatured && "rotate-180"
              )} />
            </button>
            
            {showFeatured && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {featuredResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Todos os Recursos */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Todos os Recursos
            </h2>
          </div>

          {resources.length > 0 ? (
            <JustifiedGrid 
              resources={resources}
              rowHeight={240}
              margin={4}
            />
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
              <p className="text-gray-600 font-semibold">Este criador ainda não publicou recursos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatItem({ icon: Icon, value, label }: { icon: any, value: string, label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <Icon className="h-6 w-6 text-secondary-600" />
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}

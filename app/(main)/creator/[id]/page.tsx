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
      let featuredQuery = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*), category:categories(*)')
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
      }
      
      setFeaturedResources(featuredData || [])

      // Carregar todos os recursos do criador
      let resourcesQuery = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*), category:categories(*)')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false })
        .limit(100)
      
      // Se não for o próprio perfil, mostrar apenas aprovados
      if (!isOwnProfile) {
        resourcesQuery = resourcesQuery.eq('status', 'approved')
      }
      
      const { data: resourcesData, error: resourcesError } = await resourcesQuery
      
      if (resourcesError) {
        console.error('Erro ao carregar recursos:', resourcesError)
        toast.error('Erro ao carregar recursos do criador')
      }

      setResources(resourcesData || [])

      // Calcular estatísticas
      const totalDownloads = resourcesData?.reduce((sum, r) => sum + r.download_count, 0) || 0
      const totalViews = resourcesData?.reduce((sum, r) => sum + r.view_count, 0) || 0

      setStats({
        totalResources: resourcesData?.length || 0,
        totalDownloads,
        totalViews,
      })
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error)
      toast.error('Erro ao carregar perfil')
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
      {/* Banner */}
      <div className="h-64 bg-gradient-to-br from-secondary-500 via-primary-500 to-secondary-600 relative overflow-hidden">
        {creator.cover_image ? (
          <Image
            src={getS3Url(creator.cover_image)}
            alt="Capa"
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
        )}
      </div>

      {/* Profile Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-10">
          {/* Avatar e Informações Principais */}
          <div className="flex flex-col items-center text-center mb-10">
            {/* Avatar */}
            <div className="relative mb-6">
              <div className="h-32 w-32 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                {creator.avatar_url ? (
                  <Image
                    src={creator.avatar_url}
                    alt={creator.full_name || 'Criador'}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center">
                    <User className="h-16 w-16 text-white" />
                  </div>
                )}
              </div>
              {creator.is_creator && (
                <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full p-1.5 border-4 border-white">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            {/* Nome */}
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {creator.full_name || 'Criador Sem Nome'}
            </h1>

            {/* Localização e Data */}
            <div className="flex items-center justify-center space-x-6 mb-4 text-gray-600">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">Brasil</span>
              </div>
              {createdDate && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Desde {createdDate}</span>
                </div>
              )}
            </div>

            {/* Mensagem de Boas-vindas */}
            <p className="text-gray-700 text-base font-medium max-w-2xl mb-6 leading-relaxed">
              Bem-vindo ao nosso perfil oficial, aqui você encontra conteúdos criativos que agregam valor aos seus projetos.
            </p>

            {/* Botões de Ação */}
            <div className="flex items-center justify-center space-x-3">
              {!isOwnProfile && (
                <button
                  onClick={handleFollow}
                  className={cn(
                    "px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center space-x-2",
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
                  className="px-6 py-3 bg-primary-500 text-white rounded-2xl font-bold text-sm hover:bg-primary-600 transition-all"
                >
                  Meu Painel
                </Link>
              )}
              {isSystemProfilePage && currentUser?.is_admin && (
                <Link
                  href="/admin/system-profile"
                  className="px-6 py-3 bg-primary-500 text-white rounded-2xl font-bold text-sm hover:bg-primary-600 transition-all"
                >
                  Editar Perfil do Sistema
                </Link>
              )}
              <button className="p-3 rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
                <Share2 className="h-5 w-5" />
              </button>
              <button className="p-3 rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
                <Bookmark className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-gray-100">
            <StatItem 
              icon={Files} 
              value={formatNumber(stats.totalResources)} 
              label="Arquivos" 
            />
            <StatItem 
              icon={Download} 
              value={formatNumber(stats.totalDownloads)} 
              label="Downloads" 
            />
            <StatItem 
              icon={Heart} 
              value={formatNumber(likesCount)} 
              label="Curtidas" 
            />
            <StatItem 
              icon={User} 
              value={formatNumber(followersCount)} 
              label="Seguidores" 
            />
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

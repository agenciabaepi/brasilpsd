'use client'

import { useEffect, useState, Suspense } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { 
  Search, 
  ChevronRight,
} from 'lucide-react'
import type { Resource } from '@/types/database'
import { cn } from '@/lib/utils/cn'
import { useSearchParams, useRouter } from 'next/navigation'
import ResourceCard from '@/components/resources/ResourceCard'
import AudioPlayer from '@/components/audio/AudioPlayer'
import SearchBar from '@/components/home/SearchBar'
import JustifiedGrid from '@/components/layout/JustifiedGrid'
import Link from 'next/link'
import { isSystemProfile } from '@/lib/utils/system'
import { useHeaderVisibility } from '@/hooks/useHeaderVisibility'

interface CategoryResources {
  video: Resource[]
  motion: Resource[]
  audio: Resource[]
  psd: Resource[]
  image: Resource[]
  font: Resource[]
}

interface CategorySlugs {
  video: string
  motion: string
  audio: string
  psd: string
  image: string
  font: string
}

interface ExploreClientProps {
  categoryResources?: CategoryResources
  categorySlugs?: CategorySlugs
  initialResources?: Resource[]
  initialCategoryId?: string
  categoryName?: string
  initialFormatFilter?: string
  hasHero?: boolean
}

export default function ExploreClient(props: ExploreClientProps) {
  return (
    <Suspense fallback={<div className="p-20 text-center">Carregando...</div>}>
      <ExploreContent {...props} />
    </Suspense>
  )
}

function ExploreContent({ 
  categoryResources, 
  categorySlugs,
  initialResources, 
  initialCategoryId, 
  categoryName, 
  initialFormatFilter,
  hasHero = false 
}: ExploreClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [searchResults, setSearchResults] = useState<Resource[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const supabase = createSupabaseClient()
  const isHeaderVisible = useHeaderVisibility()

  // Verificar se há busca ativa
  const hasActiveSearch = searchQuery.trim().length > 0
  
  // Se não tiver categoryResources mas tiver initialResources, usar modo de compatibilidade
  const isLegacyMode = !categoryResources && initialResources

  useEffect(() => {
    loadFavorites()
    
    // Se houver busca na URL, executar
    const q = searchParams.get('q')
    if (q) {
      setSearchQuery(q)
      handleSearch(q)
    }
  }, [])

  async function loadFavorites() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('favorites')
      .select('resource_id')
      .eq('user_id', user.id)

    if (data) {
      setFavorites(new Set(data.map(f => f.resource_id)))
    }
  }

  async function handleSearch(term: string) {
    if (!term.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setSearchResults(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar recursos:', error)
    } finally {
      setIsSearching(false)
    }
  }

  async function handleFavorite(resourceId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return
    }

    const isFavorited = favorites.has(resourceId)

    if (isFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resourceId)

      if (!error) {
        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(resourceId)
          return newSet
        })
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          resource_id: resourceId,
        })

      if (!error) {
        setFavorites(prev => new Set(prev).add(resourceId))
      }
    }
  }

  const getArtistName = (resource: Resource) => {
    if (resource.is_official || isSystemProfile(resource.creator_id)) {
      return 'BrasilPSD'
    }
    return (resource.creator as any)?.full_name || 'Desconhecido'
  }

  // Categorias (apenas se não estiver em modo legado)
  const categories = categoryResources && categorySlugs ? [
    {
      id: 'video',
      title: 'Banco de Vídeo',
      resources: categoryResources.video,
      href: `/categories/${categorySlugs.video}`,
    },
    {
      id: 'motion',
      title: 'Modelos de Vídeo',
      resources: categoryResources.motion,
      href: `/categories/${categorySlugs.motion}`,
    },
    {
      id: 'audio',
      title: 'Músicas',
      resources: categoryResources.audio,
      href: `/categories/${categorySlugs.audio}`,
    },
    {
      id: 'psd',
      title: 'PSDs',
      resources: categoryResources.psd,
      href: `/categories/${categorySlugs.psd}`,
    },
    {
      id: 'image',
      title: 'Imagens',
      resources: categoryResources.image,
      href: `/categories/${categorySlugs.image}`,
    },
    {
      id: 'font',
      title: 'Fontes',
      resources: categoryResources.font,
      href: `/categories/${categorySlugs.font}`,
    },
  ] : []

  // Modo legado: exibir recursos em grid simples (compatibilidade com outras páginas)
  if (isLegacyMode) {
    const displayResources = hasActiveSearch ? searchResults : (initialResources || [])

    // Calcular altura dinâmica baseada na visibilidade do header
    // Header visível: 100vh - 168px (PromotionalBar + Header)
    // Header oculto: 100vh - 40px (apenas PromotionalBar)
    const containerHeight = isHeaderVisible 
      ? 'calc(100vh - 168px)' 
      : 'calc(100vh - 40px)'

  return (
    <div className={cn("bg-white overflow-hidden transition-all duration-300", hasHero ? "min-h-screen" : "")} style={!hasHero ? { height: containerHeight } : undefined}>
      <div className={cn("max-w-[1600px] mx-auto flex relative", hasHero ? "min-h-[calc(100vh-64px)]" : "h-full")}>
        <main className={cn(
          "flex-1 flex flex-col p-8 lg:p-12",
          hasHero ? "min-h-[calc(100vh-64px)]" : "h-full overflow-hidden"
        )}>
            {/* Header */}
          <div className={`flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 transition-all duration-300 ${
            isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full h-0 mb-0 overflow-hidden'
          }`}>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {categoryName || 'Todos os Recursos'}
                </h1>
                <p className="text-gray-700 text-base mt-1">
                  {hasActiveSearch 
                    ? `Encontramos ${searchResults.length} resultados para "${searchQuery}"`
                    : `Encontramos aproximadamente ${displayResources.length} resultados${categoryName ? ` em ${categoryName}` : ''}.`
                  }
                </p>
              </div>
            </div>

            {/* Barra de Pesquisa */}
            <div className={`mb-8 transition-all duration-300 ${
              isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full h-0 mb-0 overflow-hidden'
            }`}>
              <SearchBar />
              </div>
              
            {/* Results Grid - JustifiedGrid como na home */}
            <div className="flex-1 overflow-y-auto scrollbar-hide pr-2 -mr-2">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                  <p className="text-gray-600 text-sm font-medium">Buscando recursos...</p>
                </div>
              ) : displayResources.length > 0 ? (
                <JustifiedGrid 
                  resources={displayResources}
                  rowHeight={240}
                  margin={4}
                />
              ) : (
                <div className="text-center py-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                    <Search className="h-8 w-8 text-gray-200" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Nenhum recurso encontrado</h3>
                  <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2">
                    {hasActiveSearch 
                      ? 'Tente pesquisar por termos diferentes.'
                      : 'Tente ajustar seus filtros ou pesquisar por termos diferentes.'
                    }
                  </p>
              </div>
              )}
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Modo novo: exibir por categorias
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Barra de Pesquisa */}
        <div className="mb-12">
          <SearchBar />
          </div>

        {/* Resultados de Busca */}
        {hasActiveSearch ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Resultados da busca: "{searchQuery}"
              </h2>
              <span className="text-sm text-gray-500">
                {isSearching ? 'Buscando...' : `${searchResults.length} resultados`}
              </span>
            </div>

            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                <p className="text-gray-600 text-sm font-medium">Buscando recursos...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {searchResults.map((resource) => (
                  <div key={resource.id} className="aspect-square w-full">
                    <ResourceCard
                      resource={resource}
                      onFavorite={handleFavorite}
                      isFavorited={favorites.has(resource.id)}
                    />
                    </div>
                  ))}
                </div>
            ) : (
              <div className="text-center py-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                  <Search className="h-8 w-8 text-gray-200" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Nenhum recurso encontrado</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2">
                  Tente pesquisar por termos diferentes.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Seções por Categoria */
          <div className="space-y-16">
            {categories.map((category) => {
              if (category.resources.length === 0) return null
              
              return (
                <section key={category.id} className="space-y-6">
                  {/* Cabeçalho da Seção */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">
                      {category.title}
                    </h2>
                    <Link
                      href={category.href}
                      className="flex items-center gap-1 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors group"
                    >
                      Mostrar tudo
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>

                  {/* Grid de Recursos - Tamanhos uniformes */}
                  {category.id === 'audio' ? (
                    // Para áudios, usar AudioPlayer
                    <div className="space-y-2">
                      {category.resources.slice(0, 5).map((resource) => (
                        <AudioPlayer
                          key={resource.id}
                          audioUrl={resource.file_url}
                          previewUrl={resource.preview_url}
                          title={resource.title}
                          artist={getArtistName(resource)}
                          duration={resource.duration || undefined}
                          resourceId={resource.id}
                          isDownloadable={false}
                          onFavorite={() => handleFavorite(resource.id)}
                          isFavorited={favorites.has(resource.id)}
                          isPlaying={playingId === resource.id}
                          onPlayStart={() => setPlayingId(resource.id)}
                          onPlayStop={() => {
                            if (playingId === resource.id) {
                              setPlayingId(null)
                            }
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    // Para outros tipos, usar ResourceCard
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {category.resources.slice(0, 5).map((resource) => (
                        <div key={resource.id} className="aspect-square w-full">
                          <ResourceCard
                            resource={resource}
                            onFavorite={handleFavorite}
                            isFavorited={favorites.has(resource.id)}
                          />
      </div>
                      ))}
    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

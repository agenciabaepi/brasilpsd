'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import AudioPlayer from './AudioPlayer'
import SubscriptionModal from '@/components/premium/SubscriptionModal'
import type { Resource } from '@/types/database'
import { Search, Filter, Check, X, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface AudiosClientProps {
  initialAudios: (Resource & { creator?: any })[]
}

export default function AudiosClient({ initialAudios }: AudiosClientProps) {
  const [audios, setAudios] = useState<(Resource & { creator?: any })[]>(initialAudios)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Fechado por padrão em mobile
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [selectedResource, setSelectedResource] = useState<Resource & { creator?: any } | null>(null)
  
  const [filters, setFilters] = useState({
    category: 'all',
    license: 'all', // all, premium, free
    duration: 'all', // all, short (0-30s), medium (30s-2min), long (2min+)
    format: 'all', // all, mp3, wav, etc
  })
  
  const supabase = createSupabaseClient()
  const router = useRouter()

  // Carregar categorias de áudio (carregar primeiro)
  useEffect(() => {
    async function loadCategories() {
      try {
        // Buscar categoria "Áudios" e suas subcategorias
        const { data: audiosCategory } = await supabase
          .from('categories')
          .select('id')
          .or('slug.eq.audios,slug.eq.áudios,slug.eq.audio')
          .is('parent_id', null)
          .maybeSingle()
        
        if (audiosCategory) {
          // Buscar a categoria principal
          const { data: mainCat } = await supabase
            .from('categories')
            .select('id, name, parent_id, order_index')
            .eq('id', audiosCategory.id)
            .single()
          
          // Buscar subcategorias ordenadas
          const { data: subCats } = await supabase
            .from('categories')
            .select('id, name, parent_id, order_index')
            .eq('parent_id', audiosCategory.id)
            .order('order_index', { ascending: true })
            .order('name', { ascending: true })
          
          // Combinar categoria principal e subcategorias (categoria principal primeiro)
          const audioCategories = [
            ...(mainCat ? [mainCat] : []),
            ...(subCats || [])
          ]
          setCategories(audioCategories)
        } else {
          console.warn('⚠️ Audio category not found')
        }
      } catch (error) {
        console.error('❌ Error loading categories:', error)
      }
    }

    // Carregar categorias primeiro (antes dos favoritos)
    loadCategories()
    loadFavorites()
  }, [supabase])

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

  // Buscar áudios com filtros
  const searchAudios = useCallback(async () => {
    setLoading(true)
    try {
      // Se for uma categoria pai, buscar IDs de subcategorias
      let categoryIds = [filters.category];
      
      if (filters.category !== 'all') {
        const { data: subcats } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', filters.category);
        
        if (subcats && subcats.length > 0) {
          categoryIds = [filters.category, ...subcats.map(s => s.id)];
        }
      }

      let query = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .eq('resource_type', 'audio')

      // Buscar por título ou palavras-chave
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,keywords.cs.{${searchQuery}}`)
      }

      // Filtro de categoria
      if (filters.category !== 'all') {
        query = query.in('category_id', categoryIds)
      }

      // Filtro de licença (premium/free)
      if (filters.license === 'premium') {
        query = query.eq('is_premium', true)
      } else if (filters.license === 'free') {
        query = query.eq('is_premium', false)
      }

      // Filtro de duração
      if (filters.duration !== 'all') {
        if (filters.duration === 'short') {
          query = query.lte('duration', 30)
        } else if (filters.duration === 'medium') {
          query = query.gte('duration', 30).lte('duration', 120)
        } else if (filters.duration === 'long') {
          query = query.gt('duration', 120)
        }
      }

      // Filtro de formato
      if (filters.format !== 'all') {
        query = query.eq('file_format', filters.format)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setAudios(data || [])
    } catch (error: any) {
      console.error('Error searching audios:', error)
      toast.error('Erro ao buscar áudios')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filters, supabase])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchAudios()
    }, 300)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters])

  const handleFavorite = async (resourceId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Faça login para favoritar áudios')
      router.push('/login')
      return
    }

    const isFavorited = favorites.has(resourceId)

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('resource_id', resourceId)

        if (error) throw error
        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(resourceId)
          return newSet
        })
        toast.success('Removido dos favoritos')
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            resource_id: resourceId
          })

        if (error) throw error
        setFavorites(prev => new Set(prev).add(resourceId))
        toast.success('Adicionado aos favoritos')
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error)
      toast.error('Erro ao atualizar favoritos')
    }
  }

  const handleDownload = async (resource: Resource) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Faça login para baixar áudios')
      router.push('/login')
      return
    }

    try {
      // Extrair key do file_url (igual ao ResourceDetailClient)
      // file_url pode ser uma URL completa ou apenas uma chave S3
      let key: string
      try {
        const url = new URL(resource.file_url)
        key = url.pathname.substring(1)
      } catch {
        // Se não for uma URL válida, assumir que é a chave direta
        key = resource.file_url
      }

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, key })
      })

      const downloadData = await response.json()

      if (!response.ok || downloadData.error) {
        // Se for erro de assinatura necessária, mostrar modal
        if (response.status === 403 && (
          downloadData.error === 'Assinatura necessária' || 
          downloadData.message?.includes('Premium') ||
          downloadData.message?.includes('assinatura')
        )) {
          setSelectedResource(resource)
          setSubscriptionModalOpen(true)
          return
        }
        throw new Error(downloadData.error || downloadData.message || 'Erro ao baixar')
      }

      if (!downloadData.url) {
        throw new Error('URL de download não recebida')
      }

      // Abrir download
      window.open(downloadData.url, '_blank')

      toast.success('Download iniciado!')
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error(error.message || 'Erro ao baixar áudio')
    }
  }

  const getArtistName = (resource: Resource & { creator?: any }) => {
    if (resource.is_official) {
      return 'BrasilPSD'
    }
    return resource.creator?.full_name || 'Desconhecido'
  }

  const formats = [
    { id: 'all', label: 'Todos os Formatos' },
    { id: 'mp3', label: 'MP3' },
    { id: 'wav', label: 'WAV' },
    { id: 'ogg', label: 'OGG' },
    { id: 'm4a', label: 'M4A' },
    { id: 'aac', label: 'AAC' },
    { id: 'flac', label: 'FLAC' },
  ]

  const licenses = [
    { id: 'all', label: 'Todas' },
    { id: 'free', label: 'Gratuitos' },
    { id: 'premium', label: 'Premium' },
  ]

  const durations = [
    { id: 'all', label: 'Qualquer Duração' },
    { id: 'short', label: 'Curto (0-30s)' },
    { id: 'medium', label: 'Médio (30s-2min)' },
    { id: 'long', label: 'Longo (2min+)' },
  ]

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Mobile Filter Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className="max-w-[1600px] mx-auto flex overflow-x-hidden">
        
        {/* SIDEBAR FILTERS - Desktop */}
        {isSidebarOpen && (
        <aside className="w-72 flex-shrink-0 border-r border-gray-100 p-8 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto hidden lg:block transition-all">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-900" />
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Filtros</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {Object.values(filters).filter(v => v !== 'all').length} aplicados
              </span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Recolher filtros"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Categorias - PRIMEIRO */}
            <FilterSection title="Categorias">
              <div className="space-y-1">
                <FilterItem 
                  label="Todas as Categorias"
                  active={filters.category === 'all'}
                  onClick={() => setFilters({...filters, category: 'all'})}
                />
                {categories.length > 0 ? (
                  categories
                    .filter(c => !c.parent_id)
                    .map((parent) => (
                      <div key={parent.id} className="space-y-1">
                        <FilterItem 
                          label={parent.name}
                          active={filters.category === parent.id}
                          onClick={() => setFilters({...filters, category: parent.id})}
                        />
                        {categories
                          .filter(c => c.parent_id === parent.id)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((sub) => (
                            <FilterItem 
                              key={sub.id}
                              label={sub.name}
                              active={filters.category === sub.id}
                              onClick={() => setFilters({...filters, category: sub.id})}
                              isSubItem
                            />
                          ))}
                      </div>
                    ))
                ) : (
                  <div className="text-sm text-gray-500 py-2">Carregando categorias...</div>
                )}
              </div>
            </FilterSection>

            {/* Licença */}
            <FilterSection title="Licença">
              <div className="space-y-1">
                {licenses.map((license) => (
                  <FilterItem
                    key={license.id}
                    label={license.label}
                    active={filters.license === license.id}
                    onClick={() => setFilters({...filters, license: license.id})}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Duração */}
            <FilterSection title="Duração">
              <div className="space-y-1">
                {durations.map((duration) => (
                  <FilterItem
                    key={duration.id}
                    label={duration.label}
                    active={filters.duration === duration.id}
                    onClick={() => setFilters({...filters, duration: duration.id})}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Formato */}
            <FilterSection title="Formato">
              <div className="space-y-1">
                {formats.map((format) => (
                  <FilterItem
                    key={format.id}
                    label={format.label}
                    active={filters.format === format.id}
                    onClick={() => setFilters({...filters, format: format.id})}
                  />
                ))}
              </div>
            </FilterSection>
          </div>
        </aside>
        )}

        {/* SIDEBAR FILTERS - Mobile Drawer */}
        <aside className={cn(
          "lg:hidden fixed top-0 left-0 w-80 h-full bg-white z-50 shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-900" />
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Filtros</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {Object.values(filters).filter(v => v !== 'all').length} aplicados
              </span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Categorias - PRIMEIRO */}
            <FilterSection title="Categorias">
              <div className="space-y-1">
                <FilterItem 
                  label="Todas as Categorias"
                  active={filters.category === 'all'}
                  onClick={() => {
                    setFilters({...filters, category: 'all'})
                    setIsSidebarOpen(false)
                  }}
                />
                {categories.length > 0 ? (
                  categories
                    .filter(c => !c.parent_id)
                    .map((parent) => (
                      <div key={parent.id} className="space-y-1">
                        <FilterItem 
                          label={parent.name}
                          active={filters.category === parent.id}
                          onClick={() => {
                            setFilters({...filters, category: parent.id})
                            setIsSidebarOpen(false)
                          }}
                        />
                        {categories
                          .filter(c => c.parent_id === parent.id)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((sub) => (
                            <FilterItem 
                              key={sub.id}
                              label={sub.name}
                              active={filters.category === sub.id}
                              onClick={() => {
                                setFilters({...filters, category: sub.id})
                                setIsSidebarOpen(false)
                              }}
                              isSubItem
                            />
                          ))}
                      </div>
                    ))
                ) : (
                  <div className="text-sm text-gray-500 py-2">Carregando categorias...</div>
                )}
              </div>
            </FilterSection>

            {/* Licença */}
            <FilterSection title="Licença">
              <div className="space-y-1">
                {licenses.map((license) => (
                  <FilterItem
                    key={license.id}
                    label={license.label}
                    active={filters.license === license.id}
                    onClick={() => {
                      setFilters({...filters, license: license.id})
                      setIsSidebarOpen(false)
                    }}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Duração */}
            <FilterSection title="Duração">
              <div className="space-y-1">
                {durations.map((duration) => (
                  <FilterItem
                    key={duration.id}
                    label={duration.label}
                    active={filters.duration === duration.id}
                    onClick={() => {
                      setFilters({...filters, duration: duration.id})
                      setIsSidebarOpen(false)
                    }}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Formato */}
            <FilterSection title="Formato">
              <div className="space-y-1">
                {formats.map((format) => (
                  <FilterItem
                    key={format.id}
                    label={format.label}
                    active={filters.format === format.id}
                    onClick={() => {
                      setFilters({...filters, format: format.id})
                      setIsSidebarOpen(false)
                    }}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Botão Limpar Filtros - Mobile */}
            {Object.values(filters).some(v => v !== 'all') && (
              <button
                onClick={() => {
                  setFilters({
                    category: 'all',
                    license: 'all',
                    duration: 'all',
                    format: 'all'
                  })
                  setIsSidebarOpen(false)
                }}
                className="w-full mt-6 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-3 md:p-8 lg:p-12 min-w-0 overflow-x-hidden">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                {/* Botão para expandir filtros quando estiverem recolhidos - Desktop */}
                {!isSidebarOpen && (
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex-shrink-0"
                    title="Mostrar filtros"
                  >
                    <Filter className="h-4 w-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-700">Filtros</span>
                    {Object.values(filters).filter(v => v !== 'all').length > 0 && (
                      <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {Object.values(filters).filter(v => v !== 'all').length}
                      </span>
                    )}
                  </button>
                )}
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Biblioteca de Áudios</h1>
              </div>
              {/* Mobile Filter Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span>Filtros</span>
                {Object.values(filters).filter(v => v !== 'all').length > 0 && (
                  <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {Object.values(filters).filter(v => v !== 'all').length}
                  </span>
                )}
              </button>
            </div>
            <p className="text-gray-700 text-sm md:text-base">
              Encontramos aproximadamente {audios.length} {audios.length === 1 ? 'áudio' : 'áudios'}.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-4 md:mb-6">
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar áudios..."
                className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Active Filters Chips */}
          {Object.values(filters).some(v => v !== 'all') && (
            <div className="mb-6 flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => {
                if (value === 'all') return null
                
                let label = value
                if (key === 'category') {
                  const cat = categories.find(c => c.id === value)
                  label = cat?.name || value
                } else if (key === 'license') {
                  label = licenses.find(l => l.id === value)?.label || value
                } else if (key === 'duration') {
                  label = durations.find(d => d.id === value)?.label || value
                } else if (key === 'format') {
                  label = formats.find(f => f.id === value)?.label || value
                }

                return (
                  <button
                    key={key}
                    onClick={() => setFilters({...filters, [key]: 'all'})}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 text-sm font-semibold rounded-lg hover:bg-primary-100 transition-all"
                  >
                    <span>{label}</span>
                    <X className="h-3 w-3" />
                  </button>
                )
              })}
            </div>
          )}

          {/* Audio List */}
          <div className="space-y-2 md:space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
                <p className="mt-4 text-gray-500">Buscando áudios...</p>
              </div>
            ) : audios.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum áudio encontrado</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-4">
                {audios.map((audio) => (
                  <AudioPlayer
                    key={audio.id}
                    audioUrl={audio.file_url}
                    previewUrl={audio.preview_url}
                    title={audio.title}
                    artist={getArtistName(audio)}
                    duration={audio.duration || undefined}
                    resourceId={audio.id}
                    isDownloadable={true}
                    onDownload={() => handleDownload(audio)}
                    onFavorite={() => handleFavorite(audio.id)}
                    isFavorited={favorites.has(audio.id)}
                    isPlaying={playingId === audio.id}
                    onPlayStart={() => setPlayingId(audio.id)}
                    onPlayStop={() => {
                      if (playingId === audio.id) {
                        setPlayingId(null)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => {
          setSubscriptionModalOpen(false)
          setSelectedResource(null)
        }}
        resourceTitle={selectedResource?.title}
        resourcePreview={
          selectedResource && (
            <AudioPlayer
              audioUrl={selectedResource.file_url}
              previewUrl={selectedResource.preview_url}
              title={selectedResource.title}
              artist={getArtistName(selectedResource)}
              duration={selectedResource.duration || undefined}
              isDownloadable={false}
              isPlaying={playingId === selectedResource.id}
              onPlayStart={() => setPlayingId(selectedResource.id)}
              onPlayStop={() => {
                if (playingId === selectedResource.id) {
                  setPlayingId(null)
                }
              }}
            />
          )
        }
        resourceType="audio"
      />
    </div>
  )
}

function FilterSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

function FilterItem({ label, active, onClick, isSubItem }: { label: string, active: boolean, onClick: () => void, isSubItem?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all",
        active
          ? "bg-primary-50 text-primary-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        isSubItem && "pl-6"
      )}
    >
      <span>{label}</span>
      {active && <Check className="h-4 w-4" />}
    </button>
  )
}


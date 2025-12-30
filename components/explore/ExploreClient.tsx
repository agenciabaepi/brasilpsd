'use client'

import { useEffect, useState, Suspense } from 'react'
import ResourceCard from '@/components/resources/ResourceCard'
import { createSupabaseClient } from '@/lib/supabase/client'
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  ChevronDown, 
  Check, 
  Image as ImageIcon,
  FileType,
  MousePointer2,
  Layout,
  Star,
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import type { Resource } from '@/types/database'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import { useSearchParams } from 'next/navigation'
import JustifiedGrid from '@/components/layout/JustifiedGrid'

interface ExploreClientProps {
  initialResources: Resource[]
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

function ExploreContent({ initialResources, initialCategoryId, categoryName, initialFormatFilter, hasHero = false }: ExploreClientProps) {
  const searchParams = useSearchParams()
  
  // Ler o tipo da query string ou usar o filtro inicial
  const typeFromQuery = searchParams.get('type') || initialFormatFilter || 'all'
  
  // Filtrar recursos iniciais se houver filtro de formato
  const filteredInitialResources = typeFromQuery !== 'all' 
    ? (initialResources || []).filter(r => r.resource_type === typeFromQuery)
    : (initialResources || [])
  
  const [resources, setResources] = useState<Resource[]>(filteredInitialResources)
  const [loading, setLoading] = useState(false)
  const [isFirstRender, setIsFirstRender] = useState(true)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Recolhido por padrão
  const [categories, setCategories] = useState<any[]>([])
  
  // FILTERS STATE - garantir que o formato inicial seja aplicado
  const [filters, setFilters] = useState({
    format: typeFromQuery !== 'all' ? typeFromQuery : (initialFormatFilter || 'all'),
    license: 'all', // all, premium, free
    orientation: 'all', // all, horizontal, vertical, square
    color: 'all'
  })

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadCategories()
    loadFavorites()
    
    // Aplicar tipo da query string ou filtro inicial se existir
    const typeParam = searchParams.get('type')
    if (typeParam && typeParam !== 'all') {
      setFilters(prev => ({ ...prev, format: typeParam }))
    } else if (initialFormatFilter && initialFormatFilter !== 'all') {
      // Se não houver type na query string, usar o filtro inicial
      setFilters(prev => ({ ...prev, format: initialFormatFilter }))
    }
    
    if (searchParams.get('q')) {
      handleSearch(searchParams.get('q') || '')
    }
    
    // Marcar que o primeiro render passou
    setIsFirstRender(false)
  }, [])

  useEffect(() => {
    // Pular o carregamento na primeira renderização se já temos dados iniciais
    if (isFirstRender) {
      return
    }

    // Só recarregar se não houver busca ativa e os recursos iniciais não corresponderem
    if (!searchParams.get('q') && initialResources.length > 0) {
      // Verificar se os recursos iniciais correspondem ao filtro atual
      const needsReload = filters.format !== 'all' && 
        !initialResources.every(r => r.resource_type === filters.format)
      
      if (needsReload) {
        loadResources()
      }
    } else if (!searchParams.get('q')) {
      loadResources()
    }
  }, [filters, searchParams, isFirstRender])

  async function loadCategories() {
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      setCategories(data || [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  async function loadResources() {
    setLoading(true)
    try {
      let query = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50)

      // Aplicar filtro de categoria inicial se existir (para páginas de categoria específica)
      if (initialCategoryId && initialCategoryId !== 'all') {
        // Se for uma categoria pai, buscar os IDs de todas as subcategorias
        const { data: subcats } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', initialCategoryId)
        
        let categoryIds = [initialCategoryId]
        if (subcats && subcats.length > 0) {
          categoryIds = [initialCategoryId, ...subcats.map(s => s.id)]
        }
        query = query.in('category_id', categoryIds)
      }

      if (filters.format !== 'all') {
        query = query.eq('resource_type', filters.format)
      }

      if (filters.license === 'premium') {
        query = query.eq('is_premium', true)
      } else if (filters.license === 'free') {
        query = query.eq('is_premium', false)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Erro ao carregar recursos:', error)
        throw error
      }
      
      // Filtrar recursos no cliente também para garantir (fallback)
      let filteredData = data || []
      if (filters.format !== 'all') {
        filteredData = filteredData.filter(r => r.resource_type === filters.format)
        console.log(`✅ Filtrados ${filteredData.length} recursos do tipo ${filters.format} de ${data?.length || 0} total`)
      }
      
      // Aplicar filtros de orientação e cor no cliente
      if (filters.orientation !== 'all') {
        filteredData = filteredData.filter(r => {
          if (!r.width || !r.height) return false
          const aspectRatio = r.width / r.height
          if (filters.orientation === 'horizontal') return aspectRatio > 1
          if (filters.orientation === 'vertical') return aspectRatio < 1
          if (filters.orientation === 'square') return Math.abs(aspectRatio - 1) < 0.1
          return true
        })
      }
      
      setResources(filteredData)
    } catch (error: any) {
      console.error('Erro ao carregar recursos:', error)
      toast.error('Erro ao carregar recursos')
    } finally {
      setLoading(false)
    }
  }

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

  async function handleFavorite(resourceId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Você precisa estar logado para favoritar')
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
        toast.success('Removido dos favoritos')
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
        toast.success('Adicionado aos favoritos')
      }
    }
  }

  async function handleSearch(term?: string) {
    const q = term !== undefined ? term : searchQuery;
    if (!q.trim()) {
      loadResources()
      return
    }

    setLoading(true)
    try {
      let query = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      // Aplicar filtro de tipo se existir
      if (filters.format !== 'all') {
        query = query.eq('resource_type', filters.format)
      }

      const { data, error } = await query

      if (error) throw error
      setResources(data || [])
    } catch (error: any) {
      toast.error('Erro ao buscar recursos')
    } finally {
      setLoading(false)
    }
  }

  // Formatos baseados nas categorias principais do sistema
  // Se estiver na página PNG, mostrar apenas formatos de imagem
  const formats = initialFormatFilter === 'png' ? [
    { id: 'all', label: 'Todos os formatos', icon: Layout },
    { id: 'png', label: 'PNG', icon: ImageIcon },
    { id: 'image', label: 'Imagens', icon: ImageIcon },
  ] : [
    { id: 'all', label: 'Todos os formatos', icon: Layout },
    { id: 'psd', label: 'PSD', icon: FileType },
    { id: 'png', label: 'PNG', icon: ImageIcon },
    { id: 'image', label: 'Imagens', icon: ImageIcon },
    { id: 'video', label: 'Vídeos', icon: MousePointer2 },
    { id: 'font', label: 'Fontes', icon: FileType },
    { id: 'ai', label: 'Vetores', icon: FileType },
    { id: 'audio', label: 'Áudios', icon: FileType },
  ]

  const orientations = [
    { id: 'all', label: 'Todas' },
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'vertical', label: 'Vertical' },
    { id: 'square', label: 'Quadrado' },
  ]

  const licenses = [
    { id: 'all', label: 'Todas as licenças' },
    { id: 'premium', label: 'Premium', icon: Star },
    { id: 'free', label: 'Grátis' },
  ]

  const colors = [
    '#FFFFFF', '#F3F4F6', '#EF4444', '#F59E0B', '#10B981', 
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#000000'
  ]

  return (
    <div className={cn("bg-white overflow-hidden", hasHero ? "min-h-screen" : "h-[calc(100vh-64px)]")}>
      <div className={cn("max-w-[1600px] mx-auto flex relative", hasHero ? "min-h-[calc(100vh-64px)]" : "h-full")}>
        
        {/* SIDEBAR FILTERS */}
        {isSidebarOpen && (
        <aside className={cn(
          "w-72 flex-shrink-0 border-r border-gray-100 bg-white p-8 hidden lg:flex flex-col transition-all duration-300 z-40",
          hasHero ? "min-h-[calc(100vh-64px)]" : "h-full"
        )}>
          <div className="flex items-center justify-between mb-8 flex-shrink-0">
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

          {/* FILTERS SECTION - Scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6 pr-2 -mr-2">
            <FilterSection title="Formato" maxHeight={formats.length > 5 ? 200 : 'none'}>
              <div className="space-y-1">
                {formats.map((f) => (
                  <FilterItem 
                    key={f.id}
                    label={f.label}
                    active={filters.format === f.id}
                    onClick={() => setFilters({...filters, format: f.id})}
                  />
                ))}
              </div>
            </FilterSection>

            {/* ORIENTATION SECTION */}
            <FilterSection title="Orientação">
              <div className="space-y-1">
                {orientations.map((o) => (
                  <FilterItem 
                    key={o.id}
                    label={o.label}
                    active={filters.orientation === o.id}
                    onClick={() => setFilters({...filters, orientation: o.id})}
                  />
                ))}
              </div>
            </FilterSection>

            {/* LICENSE SECTION */}
            <FilterSection title="Licença">
              <div className="space-y-1">
                {licenses.map((l) => (
                  <FilterItem 
                    key={l.id}
                    label={l.label}
                    active={filters.license === l.id}
                    onClick={() => setFilters({...filters, license: l.id})}
                  />
                ))}
              </div>
            </FilterSection>

            {/* COLOR SECTION */}
            <FilterSection title="Cor">
              <div className="flex flex-wrap gap-2 pt-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilters({...filters, color: c === filters.color ? 'all' : c})}
                    className={cn(
                      "h-6 w-6 rounded-full border border-gray-200 transition-transform hover:scale-110",
                      filters.color === c && "ring-2 ring-primary-500 ring-offset-2 scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </FilterSection>
          </div>
        </aside>
        )}

        {/* MAIN CONTENT */}
        <main className={cn(
          "flex-1 flex flex-col p-8 lg:p-12",
          hasHero ? "min-h-[calc(100vh-64px)]" : "h-full overflow-hidden"
        )}>
          {/* Header Area - Fixed */}
          <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div className="flex items-center gap-4">
              {/* Botão para expandir filtros quando estiverem recolhidos */}
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
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {categoryName || (filters.format === 'all' ? 'Todos os Recursos' : formats.find(f => f.id === filters.format)?.label)}
                </h1>
                <p className="text-gray-700 text-base mt-1">
                  Encontramos aproximadamente {resources.length} resultados{categoryName ? ` em ${categoryName}` : ''}.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <select className="appearance-none bg-gray-50 border border-gray-100 rounded-xl px-6 py-3 pr-12 text-base font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all">
                  <option>Destaques</option>
                  <option>Mais recentes</option>
                  <option>Mais baixados</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                {/* Controle de Tamanho (apenas no modo grid) */}
                {/* Controles de Visualização */}
                <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-secondary-600" : "text-gray-600")}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white shadow-sm text-secondary-600" : "text-gray-600")}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE FILTERS CHIPS - Ocultar na página PNG */}
          {!initialFormatFilter && Object.values(filters).some(v => v !== 'all') && (
            <div className="flex-shrink-0 flex flex-wrap gap-2 mb-8">
              {Object.entries(filters).map(([key, value]) => {
                if (value === 'all') return null;
                if (key === 'category' && initialCategoryId) return null;

                const labelMap: Record<string, string> = {
                  format: 'Formato',
                  license: 'Licença',
                  orientation: 'Orientação',
                  color: 'Cor'
                };

                const displayValue = value;

                return (
                  <button 
                    key={key}
                    onClick={() => setFilters({...filters, [key]: 'all'})}
                    className="flex items-center space-x-2 bg-gray-900 text-white px-3 py-1.5 rounded-full text-[10px] font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <span className="opacity-70">{labelMap[key] || key}:</span>
                    <span>{displayValue}</span>
                    <X className="h-3 w-3" />
                  </button>
                );
              })}
              <button 
                onClick={() => setFilters({format: 'all', license: 'all', orientation: 'all', color: 'all'})}
                className="text-secondary-600 text-[10px] font-bold hover:underline ml-2"
              >
                Limpar todos
              </button>
            </div>
          )}

          {/* RESULTS GRID - Scrollable */}
          <div className="flex-1 overflow-y-auto scrollbar-hide pr-2 -mr-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                <p className="text-gray-600 text-sm font-medium">Buscando os melhores recursos...</p>
              </div>
            ) : resources.length > 0 ? (
              <>
                {viewMode === 'grid' ? (
                  <JustifiedGrid
                    resources={resources}
                    rowHeight={240}
                    margin={4}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {resources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        onFavorite={handleFavorite}
                        isFavorited={favorites.has(resource.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-32 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                  <Search className="h-8 w-8 text-gray-200" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Nenhum recurso encontrado</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2">
                  Tente ajustar seus filtros ou pesquisar por termos diferentes.
                </p>
                <Button 
                  variant="ghost" 
                  className="mt-6 text-primary-500 font-bold uppercase text-[10px] tracking-widest"
                  onClick={() => setFilters({format: 'all', license: 'all', orientation: 'all', color: 'all'})}
                >
                  Resetar todos os filtros
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function FilterSection({ title, children, maxHeight = 'none' }: { title: string, children: React.ReactNode, maxHeight?: string | number }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-gray-700 tracking-tight border-b border-gray-50 pb-2 flex-shrink-0">
        {title}
      </h3>
      <div 
        className={maxHeight !== 'none' ? 'overflow-y-auto scrollbar-hide pr-2 -mr-2' : ''}
        style={maxHeight !== 'none' ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } : {}}
      >
        {children}
      </div>
    </div>
  )
}

function FilterItem({ label, active, onClick, isSubItem }: { label: string, active: boolean, onClick: () => void, isSubItem?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2 rounded-lg text-base transition-all group",
        active ? "bg-primary-50 text-gray-900 font-bold" : "text-gray-700 hover:bg-gray-50",
        isSubItem && "pl-8 text-sm"
      )}
    >
      <div className="flex items-center">
        {isSubItem && <ChevronRight className="h-3 w-3 mr-2 opacity-30" />}
        <span>{label}</span>
      </div>
      {active ? (
        <Check className="h-4 w-4" />
      ) : (
        <div className="h-4 w-4 border border-gray-200 rounded group-hover:border-primary-200 transition-colors" />
      )}
    </button>
  )
}


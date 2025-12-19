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
  ChevronRight
} from 'lucide-react'
import type { Resource } from '@/types/database'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import { useSearchParams } from 'next/navigation'

interface ExploreClientProps {
  initialResources: Resource[]
  initialCategoryId?: string
  categoryName?: string
}

export default function ExploreClient(props: ExploreClientProps) {
  return (
    <Suspense fallback={<div className="p-20 text-center">Carregando...</div>}>
      <ExploreContent {...props} />
    </Suspense>
  )
}

function ExploreContent({ initialResources, initialCategoryId, categoryName }: ExploreClientProps) {
  const searchParams = useSearchParams()
  const [resources, setResources] = useState<Resource[]>(initialResources)
  const [loading, setLoading] = useState(false)
  const [isFirstRender, setIsFirstRender] = useState(true)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [categories, setCategories] = useState<any[]>([])
  
  // Ler o tipo da query string
  const typeFromQuery = searchParams.get('type') || 'all'
  
  // FILTERS STATE
  const [filters, setFilters] = useState({
    format: typeFromQuery !== 'all' ? typeFromQuery : 'all',
    license: 'all', // all, premium, free
    orientation: 'all', // all, horizontal, vertical, square
    color: 'all',
    category: initialCategoryId || 'all'
  })

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadCategories()
    loadFavorites()
    
    // Aplicar tipo da query string se existir
    const typeParam = searchParams.get('type')
    if (typeParam && typeParam !== 'all') {
      setFilters(prev => ({ ...prev, format: typeParam }))
    }
    
    if (searchParams.get('q')) {
      handleSearch(searchParams.get('q') || '')
    }
    
    // Marcar que o primeiro render passou
    setIsFirstRender(false)
  }, [])

  useEffect(() => {
    // Pular o carregamento na primeira renderização se já temos dados iniciais
    // e os filtros são os mesmos que os iniciais
    if (isFirstRender && initialResources.length > 0) {
      return
    }

    if (!searchParams.get('q')) {
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
      // Se for uma categoria pai, precisamos buscar os IDs de todas as subcategorias
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
        .order('created_at', { ascending: false })
        .limit(50)

      if (filters.format !== 'all') {
        query = query.eq('resource_type', filters.format)
      }

      if (filters.category !== 'all') {
        query = query.in('category_id', categoryIds)
      }

      if (filters.license === 'premium') {
        query = query.eq('is_premium', true)
      } else if (filters.license === 'free') {
        query = query.eq('is_premium', false)
      }

      const { data, error } = await query

      if (error) throw error
      setResources(data || [])
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

  const formats = [
    { id: 'all', label: 'Todos os formatos', icon: Layout },
    { id: 'psd', label: 'PSD', icon: FileType },
    { id: 'image', label: 'Imagens', icon: ImageIcon },
    { id: 'video', label: 'Vídeos', icon: MousePointer2 },
    { id: 'font', label: 'Fontes', icon: FileType },
    { id: 'ai', label: 'Vetores AI', icon: FileType },
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
    <div className="min-h-screen bg-white">
      <div className="max-w-[1600px] mx-auto flex">
        
        {/* SIDEBAR FILTERS */}
        <aside className={cn(
          "w-72 flex-shrink-0 border-r border-gray-100 p-8 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto hidden lg:block transition-all",
          !isSidebarOpen && "-ml-72 opacity-0"
        )}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-900" />
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Filtros</h2>
            </div>
            <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {Object.values(filters).filter(v => v !== 'all').length} aplicados
            </span>
          </div>

          {/* FORMAT SECTION */}
          <div className="space-y-6">
            <FilterSection title="Categorias">
              <div className="space-y-1">
                <FilterItem 
                  label="Todas as Categorias"
                  active={filters.category === 'all'}
                  onClick={() => setFilters({...filters, category: 'all'})}
                />
                {categories
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
                  ))}
              </div>
            </FilterSection>

            <FilterSection title="Formato">
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

        {/* MAIN CONTENT */}
        <main className="flex-1 p-8 lg:p-12">
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {categoryName || (filters.format === 'all' ? 'Todos os Recursos' : formats.find(f => f.id === filters.format)?.label)}
              </h1>
              <p className="text-gray-700 text-base mt-1">
                Encontramos aproximadamente {resources.length} resultados{categoryName ? ` em ${categoryName}` : ''}.
              </p>
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
              
              <div className="hidden sm:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
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

          {/* ACTIVE FILTERS CHIPS */}
          {Object.values(filters).some(v => v !== 'all') && (
            <div className="flex flex-wrap gap-2 mb-8">
              {Object.entries(filters).map(([key, value]) => {
                if (value === 'all') return null;
                
                // Não mostra o chip de categoria se já estivermos na página da categoria
                if (key === 'category' && initialCategoryId) return null;

                const labelMap: Record<string, string> = {
                  format: 'Formato',
                  license: 'Licença',
                  orientation: 'Orientação',
                  color: 'Cor',
                  category: 'Categoria'
                };

                const displayValue = key === 'category' ? (categoryName || value) : value;

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
                onClick={() => setFilters({format: 'all', license: 'all', orientation: 'all', color: 'all', category: initialCategoryId || 'all'})}
                className="text-secondary-600 text-[10px] font-bold hover:underline ml-2"
              >
                Limpar todos
              </button>
            </div>
          )}

          {/* RESULTS GRID */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
              <p className="text-gray-600 text-sm font-medium">Buscando os melhores recursos...</p>
            </div>
          ) : resources.length > 0 ? (
            <div className={cn(
              "gap-6",
              viewMode === 'grid' ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-5 2xl:columns-6" : "flex flex-col"
            )}>
              {resources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onFavorite={handleFavorite}
                  isFavorited={favorites.has(resource.id)}
                />
              ))}
            </div>
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
        </main>
      </div>
    </div>
  )
}

function FilterSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-gray-700 tracking-tight border-b border-gray-50 pb-2">
        {title}
      </h3>
      {children}
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


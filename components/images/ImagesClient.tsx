'use client'

import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Search, Filter, X, Star, Layout, ImageIcon, FileType, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import { cn } from '@/lib/utils/cn'
import JustifiedGrid from '@/components/layout/JustifiedGrid'

interface ImagesClientProps {
  initialResources: any[]
  categories?: any[]
}

export default function ImagesClient({ initialResources }: ImagesClientProps) {
  const [resources, setResources] = useState(initialResources)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Recolhido por padrão
  const [filters, setFilters] = useState({
    format: 'all',
    license: 'all',
    orientation: 'all',
    color: 'all'
  })
  const [page, setPage] = useState(1)
  const supabase = createSupabaseClient()

  const filteredResources = resources.filter(resource => {
    const matchesSearch = !searchQuery || 
      resource.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Aplicar filtros
    if (filters.format !== 'all' && resource.resource_type !== filters.format) return false
    if (filters.license === 'premium' && !resource.is_premium) return false
    if (filters.license === 'free' && resource.is_premium) return false
    if (filters.orientation !== 'all') {
      if (!resource.width || !resource.height) return false
      const aspectRatio = resource.width / resource.height
      if (filters.orientation === 'horizontal' && aspectRatio <= 1) return false
      if (filters.orientation === 'vertical' && aspectRatio >= 1) return false
      if (filters.orientation === 'square' && Math.abs(aspectRatio - 1) >= 0.1) return false
    }
    
    return matchesSearch
  })

  async function loadMore() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .in('resource_type', ['image', 'png'])
        .order('created_at', { ascending: false })
        .range(page * 50, (page + 1) * 50 - 1)

      if (data && data.length > 0) {
        setResources(prev => [...prev, ...data])
        setPage(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error loading more:', error)
    } finally {
      setLoading(false)
    }
  }

  const formats = [
    { id: 'all', label: 'Todos os formatos', icon: Layout },
    { id: 'image', label: 'Imagens', icon: ImageIcon },
    { id: 'png', label: 'PNG', icon: ImageIcon },
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
    <div className="h-[calc(100vh-64px)] bg-white overflow-hidden">
      <div className="max-w-[1600px] mx-auto h-full flex relative">
        
        {/* SIDEBAR FILTERS */}
        {isSidebarOpen && (
        <aside className="w-72 flex-shrink-0 border-r border-gray-100 bg-white p-8 h-full overflow-y-hidden hidden lg:flex flex-col z-40">
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
        <main className="flex-1 h-full flex flex-col overflow-hidden p-8 lg:p-12">
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
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Imagens</h1>
                <p className="text-gray-700 text-base mt-1">
                  Encontramos aproximadamente {filteredResources.length} resultados.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar imagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all"
          />
        </div>

            </div>
          </div>

          {/* ACTIVE FILTERS CHIPS */}
          {Object.values(filters).some(v => v !== 'all') && (
            <div className="flex-shrink-0 flex flex-wrap gap-2 mb-8">
              {Object.entries(filters).map(([key, value]) => {
                if (value === 'all') return null;
                
                const labelMap: Record<string, string> = {
                  format: 'Formato',
                  license: 'Licença',
                  orientation: 'Orientação',
                  color: 'Cor'
                };

                const displayValue = value === 'png' ? 'PNG' : 
                                   value === 'image' ? 'Imagens' :
                                   value === 'premium' ? 'Premium' :
                                   value === 'free' ? 'Grátis' :
                                   value === 'horizontal' ? 'Horizontal' :
                                   value === 'vertical' ? 'Vertical' :
                                   value === 'square' ? 'Quadrado' : value;

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
                <p className="text-gray-600 text-sm font-medium">Carregando imagens...</p>
              </div>
            ) : filteredResources.length > 0 ? (
              <>
                <JustifiedGrid
                  resources={filteredResources}
                  rowHeight={240}
                  margin={4}
                />

                {/* Botão Carregar Mais */}
                {resources.length >= page * 50 && (
                  <div className="text-center mt-8">
                    <Button
                      onClick={loadMore}
                      disabled={loading}
                      variant="outline"
                    >
                      {loading ? 'Carregando...' : 'Carregar Mais'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500">Nenhuma imagem encontrada</p>
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

function FilterItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2 rounded-lg text-base transition-all group",
        active ? "bg-primary-50 text-gray-900 font-bold" : "text-gray-700 hover:bg-gray-50"
      )}
    >
      <span>{label}</span>
      {active ? (
        <Check className="h-4 w-4" />
      ) : (
        <div className="h-4 w-4 border border-gray-200 rounded group-hover:border-primary-200 transition-colors" />
      )}
    </button>
  )
}




'use client'

import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import ResourceCard from '@/components/resources/ResourceCard'
import { Search, Filter, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'

interface ImagesClientProps {
  initialResources: any[]
  categories: any[]
}

export default function ImagesClient({ initialResources, categories }: ImagesClientProps) {
  const [resources, setResources] = useState(initialResources)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const supabase = createSupabaseClient()

  const filteredResources = resources.filter(resource => {
    const matchesSearch = !searchQuery || 
      resource.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategories = selectedCategories.length === 0 || 
      selectedCategories.includes(resource.category_id)
    
    return matchesSearch && matchesCategories
  })

  async function loadMore() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .eq('resource_type', 'image')
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

  function toggleCategory(categoryId: string) {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const mainCategories = categories.filter(c => !c.parent_id)

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Imagens</h1>
        <p className="text-gray-600">
          Explore nossa coleção de imagens de alta qualidade
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-8 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar imagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all"
          />
        </div>

        {/* Categorias */}
        {mainCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mainCategories.map(category => (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategories.includes(category.id)
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid de Imagens */}
      {filteredResources.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
            {filteredResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>

          {/* Botão Carregar Mais */}
          {resources.length >= page * 50 && (
            <div className="text-center">
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
  )
}


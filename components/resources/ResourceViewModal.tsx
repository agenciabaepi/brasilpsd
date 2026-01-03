'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
import ResourceDetailClient from './ResourceDetailClient'
import type { Resource, Profile, Collection } from '@/types/database'

interface ResourceViewModalProps {
  resourceId: string | null
  isOpen: boolean
  onClose: () => void
}

export default function ResourceViewModal({ resourceId, isOpen, onClose }: ResourceViewModalProps) {
  const [resource, setResource] = useState<Resource | null>(null)
  const [user, setUser] = useState<Profile | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [collectionResources, setCollectionResources] = useState<Resource[]>([])
  const [relatedResources, setRelatedResources] = useState<Resource[]>([])
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!isOpen || !resourceId) {
      setResource(null)
      return
    }

    async function loadResource() {
      setLoading(true)
      try {
        // Buscar recurso
        const { data: resourceData, error: resourceError } = await supabase
          .from('resources')
          .select('*, creator:profiles!creator_id(*)')
          .eq('id', resourceId)
          .single()

        if (resourceError || !resourceData) {
          console.error('Erro ao carregar recurso:', resourceError)
          return
        }

        setResource(resourceData)

        // Incrementar visualização
        await supabase.rpc('increment', {
          table_name: 'resources',
          column_name: 'view_count',
          row_id: resourceId,
        })

        // Buscar usuário e favorito
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()
          setUser(profile || null)

          const { data: favorite } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', authUser.id)
            .eq('resource_id', resourceId)
            .single()
          setIsFavorited(!!favorite)
        }

        // Buscar coleção e recursos da coleção
        const { data: collectionResourceList } = await supabase
          .from('collection_resources')
          .select('collection_id')
          .eq('resource_id', resourceId)
          .limit(1)

        const collectionResourceData = collectionResourceList?.[0]

        if (collectionResourceData?.collection_id) {
          // Buscar dados da coleção
          const { data: collectionData } = await supabase
            .from('collections')
            .select('*, creator:profiles!creator_id(*)')
            .eq('id', collectionResourceData.collection_id)
            .eq('status', 'approved')
            .maybeSingle()

          if (collectionData) {
            setCollection(collectionData)

            // Buscar os outros recursos da mesma coleção
            const { data: otherCollectionResources } = await supabase
              .from('collection_resources')
              .select('resource_id, order_index')
              .eq('collection_id', collectionData.id)
              .neq('resource_id', resourceId)
              .order('order_index', { ascending: true })
              .limit(6)

            if (otherCollectionResources && otherCollectionResources.length > 0) {
              const resourceIds = otherCollectionResources.map((cr: any) => cr.resource_id)

              const { data: resourcesData } = await supabase
                .from('resources')
                .select('*, creator:profiles!creator_id(*)')
                .in('id', resourceIds)
                .eq('status', 'approved')

              if (resourcesData) {
                const resourceMap = new Map(resourcesData.map((r: any) => [r.id, r]))
                const orderedResources = otherCollectionResources
                  .map((cr: any) => resourceMap.get(cr.resource_id))
                  .filter(Boolean)
                setCollectionResources(orderedResources)
              }
            }
          }
        }

        // Buscar recursos relacionados
        let related: Resource[] = []

        // Tentar buscar por subcategoria primeiro
        if (resourceData.category_id) {
          const { data: currentCategory } = await supabase
            .from('categories')
            .select('id, parent_id')
            .eq('id', resourceData.category_id)
            .single()

          if (currentCategory) {
            if (currentCategory.parent_id) {
              // É subcategoria - buscar apenas da mesma subcategoria
              const { data: subcategoryResources } = await supabase
                .from('resources')
                .select('*, creator:profiles!creator_id(*)')
                .eq('status', 'approved')
                .eq('category_id', resourceData.category_id)
                .neq('id', resourceId)
                .order('view_count', { ascending: false })
                .limit(8)

              if (subcategoryResources && subcategoryResources.length > 0) {
                related = subcategoryResources
              }
            } else {
              // É categoria principal - buscar subcategorias
              const { data: subcategories } = await supabase
                .from('categories')
                .select('id')
                .eq('parent_id', currentCategory.id)

              if (subcategories && subcategories.length > 0) {
                const subcategoryIds = subcategories.map(c => c.id)
                const { data: categoryResources } = await supabase
                  .from('resources')
                  .select('*, creator:profiles!creator_id(*)')
                  .eq('status', 'approved')
                  .in('category_id', [resourceData.category_id, ...subcategoryIds])
                  .neq('id', resourceId)
                  .order('view_count', { ascending: false })
                  .limit(8)

                if (categoryResources && categoryResources.length > 0) {
                  related = categoryResources
                }
              } else {
                // Sem subcategorias, buscar apenas da mesma categoria
                const { data: categoryResources } = await supabase
                  .from('resources')
                  .select('*, creator:profiles!creator_id(*)')
                  .eq('status', 'approved')
                  .eq('category_id', resourceData.category_id)
                  .neq('id', resourceId)
                  .order('view_count', { ascending: false })
                  .limit(8)

                if (categoryResources && categoryResources.length > 0) {
                  related = categoryResources
                }
              }
            }
          }
        }

        // Se não encontrou recursos suficientes por categoria, buscar por tipo
        if (related.length < 8 && resourceData.resource_type) {
          const remaining = 8 - related.length
          const existingIds = related.map(r => r.id).concat(resourceId)

          const { data: typeResources } = await supabase
            .from('resources')
            .select('*, creator:profiles!creator_id(*)')
            .eq('status', 'approved')
            .eq('resource_type', resourceData.resource_type)
            .neq('id', resourceId)
            .order('view_count', { ascending: false })
            .limit(remaining + existingIds.length)

          if (typeResources && typeResources.length > 0) {
            const newResources = typeResources.filter((r: any) => !existingIds.includes(r.id))
            related = [...related, ...newResources].slice(0, 8)
          }
        }

        setRelatedResources(related)
      } catch (error) {
        console.error('Erro ao carregar recurso:', error)
      } finally {
        setLoading(false)
      }
    }

    loadResource()
  }, [isOpen, resourceId, supabase])

  // Fechar modal com ESC
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevenir scroll do body quando modal está aberto
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !resourceId) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        // Fechar ao clicar no backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={(e) => {
          // Fechar ao clicar no backdrop
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      />
      
      {/* Modal Content */}
      <div 
        className="relative z-10 w-full max-w-7xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" 
        data-resource-modal
        onClick={(e) => {
          // Prevenir que cliques dentro do modal fechem ele
          e.stopPropagation()
        }}
      >
        {/* Header com botão fechar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Visualizar Recurso</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
            </div>
          ) : resource ? (
            <div className="p-0">
              <ResourceDetailClient
                resource={resource}
                initialUser={user}
                initialIsFavorited={isFavorited}
                initialDownloadStatus={null}
                initialAlreadyDownloadedToday={false}
                collection={collection}
                collectionResources={collectionResources}
                relatedResources={relatedResources}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-32">
              <p className="text-gray-500">Recurso não encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Eye, Image as ImageIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import toast from 'react-hot-toast'
import type { Collection } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'

export default function CollectionsPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!profile || !profile.is_creator) {
        toast.error('Apenas criadores podem gerenciar coleções')
        router.push('/dashboard')
        return
      }

      setUser(profile)

      // Carregar coleções do criador
      const { data: collectionsData, error } = await supabase
        .from('collections')
        .select(`
          *,
          creator:profiles!creator_id(*)
        `)
        .eq('creator_id', authUser.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Processar contagem de recursos e buscar preview de 4 recursos
      const collectionsWithCount = await Promise.all(
        (collectionsData || []).map(async (collection: any) => {
          // Contar recursos
          const { count, error: countError } = await supabase
            .from('collection_resources')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id)

          if (countError) {
            console.error('Erro ao contar recursos:', countError)
          }

          // Buscar 4 recursos aleatórios para preview
          const { data: collectionResources } = await supabase
            .from('collection_resources')
            .select(`
              *,
              resource:resources!resource_id(*, creator:profiles!creator_id(*))
            `)
            .eq('collection_id', collection.id)
            .order('order_index', { ascending: true })
            .limit(4)

          const previewResources = (collectionResources || [])
            .map((cr: any) => cr.resource)
            .filter((r: any) => r && r.thumbnail_url) // Apenas recursos com thumbnail

          return {
            ...collection,
            resources_count: count || 0,
            preview_resources: previewResources
          }
        })
      )

      setCollections(collectionsWithCount)
    } catch (error: any) {
      console.error('Erro ao carregar coleções:', error)
      toast.error('Erro ao carregar coleções')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(collectionId: string) {
    if (!confirm('Tem certeza que deseja excluir esta coleção?')) return

    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId)

      if (error) throw error

      toast.success('Coleção excluída com sucesso')
      loadData()
    } catch (error: any) {
      console.error('Erro ao excluir coleção:', error)
      toast.error('Erro ao excluir coleção')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <p className="text-gray-500">Carregando coleções...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Minhas Coleções</h1>
          <p className="text-gray-600">Organize seus recursos em coleções temáticas</p>
        </div>
        <Button
          onClick={() => router.push('/creator/collections/new')}
          variant="primary"
          className="flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Nova Coleção
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma coleção criada</h3>
          <p className="text-gray-600 mb-6">Comece criando sua primeira coleção para organizar seus recursos</p>
          <Button
            onClick={() => router.push('/creator/collections/new')}
            variant="primary"
          >
            Criar Primeira Coleção
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection: any) => (
            <Card key={collection.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-48 bg-gray-100">
                {/* Grid 2x2 de recursos preview */}
                {collection.preview_resources && collection.preview_resources.length > 0 ? (
                  <div className="grid grid-cols-2 gap-0 h-full">
                    {collection.preview_resources.map((resource: any, index: number) => (
                      <div key={resource.id || index} className="aspect-square relative overflow-hidden bg-gray-50">
                        {resource.thumbnail_url ? (
                          <Image
                            src={getS3Url(resource.thumbnail_url)}
                            alt={resource.title || 'Preview'}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <ImageIcon className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Preencher espaços vazios se tiver menos de 4 recursos */}
                    {collection.preview_resources.length < 4 && (
                      Array.from({ length: 4 - collection.preview_resources.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square bg-gray-50 flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-gray-300" />
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="h-full bg-gradient-to-br from-primary-100 to-gray-100 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-primary-300" />
                  </div>
                )}
                
                {/* Badges de status */}
                {collection.status === 'pending' && (
                  <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
                    Pendente
                  </div>
                )}
                {collection.status === 'approved' && collection.is_featured && (
                  <div className="absolute top-2 right-2 bg-primary-500 text-white text-xs font-semibold px-2 py-1 rounded">
                    Destaque
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {collection.title}
                </h3>
                {collection.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {collection.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{collection.resources_count || 0} recursos</span>
                  <span>{collection.view_count || 0} visualizações</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/collections/${collection.id}`)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/creator/collections/${collection.id}/edit`)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(collection.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


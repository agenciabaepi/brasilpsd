'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import toast from 'react-hot-toast'
import type { Collection, Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'
import ResourceCard from '@/components/resources/ResourceCard'

export default function EditCollectionPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createSupabaseClient()
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [availableResources, setAvailableResources] = useState<Resource[]>([])
  const [showAddResource, setShowAddResource] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: ''
  })

  useEffect(() => {
    if (collectionId) {
      loadCollection()
    }
  }, [collectionId])

  async function loadCollection() {
    if (!collectionId) return

    try {
      setLoading(true)

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/login')
        return
      }

      // Carregar coleção
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .single()

      if (collectionError) throw collectionError

      if (collectionData.creator_id !== user.id) {
        toast.error('Você não tem permissão para editar esta coleção')
        router.push('/creator/collections')
        return
      }

      setCollection(collectionData)
      setFormData({
        title: collectionData.title,
        description: collectionData.description || '',
        slug: collectionData.slug
      })

      // Carregar recursos da coleção
      const { data: collectionResources, error: resourcesError } = await supabase
        .from('collection_resources')
        .select(`
          *,
          resource:resources!resource_id(*, creator:profiles!creator_id(*))
        `)
        .eq('collection_id', collectionId)
        .order('order_index', { ascending: true })

      if (resourcesError) throw resourcesError

      const resourcesList = (collectionResources || []).map((cr: any) => cr.resource).filter(Boolean)
      setResources(resourcesList)

      // Carregar recursos disponíveis do criador
      const { data: allResources, error: availableError } = await supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('creator_id', user.id)
        .eq('status', 'approved')

      if (availableError) throw availableError

      // Filtrar recursos que já estão na coleção
      const resourceIdsInCollection = new Set(resourcesList.map((r: Resource) => r.id))
      const availableData = (allResources || []).filter(
        (resource: Resource) => !resourceIdsInCollection.has(resource.id)
      )

      setAvailableResources(availableData)
    } catch (error: any) {
      console.error('Erro ao carregar coleção:', error)
      toast.error('Erro ao carregar coleção')
    } finally {
      setLoading(false)
    }
  }


  async function handleSave() {
    if (!collectionId) return

    setSaving(true)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Não autorizado')
        return
      }

      // Atualizar coleção
      const { error } = await supabase
        .from('collections')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          slug: formData.slug.trim()
        })
        .eq('id', collectionId)

      if (error) throw error

      toast.success('Coleção atualizada com sucesso!')
      loadCollection()
    } catch (error: any) {
      console.error('Erro ao salvar coleção:', error)
      toast.error(error.message || 'Erro ao salvar coleção')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddResource(resourceId: string) {
    if (!collectionId) return

    try {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('collection_resources')
        .select('id')
        .eq('collection_id', collectionId)
        .eq('resource_id', resourceId)
        .single()

      if (existing) {
        toast.error('Este recurso já está na coleção')
        return
      }

      // Adicionar recurso
      const { error } = await supabase
        .from('collection_resources')
        .insert({
          collection_id: collectionId,
          resource_id: resourceId,
          order_index: resources.length
        })

      if (error) throw error

      toast.success('Recurso adicionado à coleção')
      loadCollection()
      setShowAddResource(false)
    } catch (error: any) {
      console.error('Erro ao adicionar recurso:', error)
      toast.error('Erro ao adicionar recurso')
    }
  }

  async function handleRemoveResource(resourceId: string) {
    if (!collectionId) return

    try {
      const { error } = await supabase
        .from('collection_resources')
        .delete()
        .eq('collection_id', collectionId)
        .eq('resource_id', resourceId)

      if (error) throw error

      toast.success('Recurso removido da coleção')
      loadCollection()
    } catch (error: any) {
      console.error('Erro ao remover recurso:', error)
      toast.error('Erro ao remover recurso')
    }
  }

  async function handleReorderResource(resourceId: string, newIndex: number) {
    if (!collectionId) return

    try {
      const { error } = await supabase
        .from('collection_resources')
        .update({ order_index: newIndex })
        .eq('collection_id', collectionId)
        .eq('resource_id', resourceId)

      if (error) throw error

      loadCollection()
    } catch (error: any) {
      console.error('Erro ao reordenar recurso:', error)
    }
  }

  const filteredAvailableResources = availableResources.filter(resource =>
    resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    resource.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <p className="text-gray-500">Carregando coleção...</p>
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <p className="text-gray-500">Coleção não encontrada</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/creator/collections')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-semibold text-gray-900">Editar Coleção</h1>

        {/* Informações da Coleção */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Informações da Coleção</h2>
          
          <div className="space-y-6">
            <Input
              label="Título da Coleção *"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />

            <Input
              label="URL Amigável (Slug)"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            />

            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <Button
              onClick={handleSave}
              variant="primary"
              isLoading={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </Card>

        {/* Recursos da Coleção */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Recursos da Coleção ({resources.length})
            </h2>
            <Button
              onClick={() => setShowAddResource(!showAddResource)}
              variant="primary"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Recurso
            </Button>
          </div>

          {/* Modal de Adicionar Recurso */}
          {showAddResource && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adicionar Recurso</h3>
                <button
                  onClick={() => setShowAddResource(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <Input
                placeholder="Buscar recursos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-4"
              />

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredAvailableResources.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    {searchQuery ? 'Nenhum recurso encontrado' : 'Todos os recursos já estão na coleção'}
                  </p>
                ) : (
                  filteredAvailableResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {resource.thumbnail_url && (
                          <Image
                            src={getS3Url(resource.thumbnail_url)}
                            alt={resource.title}
                            width={50}
                            height={50}
                            className="rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {resource.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {resource.resource_type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAddResource(resource.id)}
                        variant="primary"
                        size="sm"
                      >
                        Adicionar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Lista de Recursos */}
          {resources.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Nenhum recurso adicionado ainda</p>
              <Button
                onClick={() => setShowAddResource(true)}
                variant="primary"
              >
                Adicionar Primeiro Recurso
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((resource, index) => (
                <div key={resource.id} className="relative group">
                  <ResourceCard resource={resource} />
                  <button
                    onClick={() => handleRemoveResource(resource.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}


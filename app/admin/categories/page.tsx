'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit, Layout, Tag as TagIcon, ChevronRight, Image as ImageIcon, X, Check } from 'lucide-react'
import type { Category } from '@/types/database'
import toast from 'react-hot-toast'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsSidebarOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', parent_id: '' })
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [resources, setResources] = useState<any[]>([])
  const [selectedResources, setSelectedResources] = useState<string[]>([])
  const [loadingResources, setLoadingResources] = useState(false)
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('order_index', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) throw error
      const loadedCategories = data || []
      setCategories(loadedCategories)
      
      // Log para debug
      console.log('Categorias carregadas:', {
        total: loadedCategories.length,
        principais: loadedCategories.filter(c => !c.parent_id).length,
        principaisNomes: loadedCategories.filter(c => !c.parent_id).map(c => c.name)
      })
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error)
      toast.error('Erro ao carregar categorias: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('O nome da categoria é obrigatório')
      return
    }

    try {
      // Gerar slug automaticamente se não fornecido
      const slug = formData.slug.trim() || formData.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .toLowerCase()

      // Verificar se já existe categoria com mesmo nome E mesmo parent_id
      // Isso permite ter "Animais" tanto para "Banco de Vídeos" quanto para "Imagens"
      const { data: existing } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('name', formData.name.trim())
        .eq('parent_id', formData.parent_id || null)
        .maybeSingle()

      if (existing) {
        const parentName = formData.parent_id 
          ? parentCategories.find(c => c.id === formData.parent_id)?.name || 'categoria pai'
          : 'categorias principais'
        toast.error(`Já existe uma categoria com o nome "${formData.name}" nesta ${parentName}`)
        return
      }

      // Verificar se já existe categoria com mesmo slug E mesmo parent_id
      const { data: existingSlug } = await supabase
        .from('categories')
        .select('id, slug, parent_id')
        .eq('slug', slug)
        .eq('parent_id', formData.parent_id || null)
        .maybeSingle()

      if (existingSlug) {
        const parentName = formData.parent_id 
          ? parentCategories.find(c => c.id === formData.parent_id)?.name || 'categoria pai'
          : 'categorias principais'
        toast.error(`Já existe uma categoria com o slug "${slug}" nesta ${parentName}`)
        return
      }

      // Validar se a categoria pai existe (se foi selecionada)
      if (formData.parent_id) {
        const { data: parentExists } = await supabase
          .from('categories')
          .select('id, name')
          .eq('id', formData.parent_id)
          .single()

        if (!parentExists) {
          toast.error('A categoria pai selecionada não existe')
          return
        }
      }

      const payload = {
        name: formData.name.trim(),
        slug: slug,
        description: formData.description.trim() || null,
        parent_id: formData.parent_id || null
      }

      console.log('Criando categoria:', payload)

      const { data, error } = await supabase
        .from('categories')
        .insert([payload])
        .select()
        .single()
      
      if (error) {
        console.error('Erro do Supabase:', error)
        throw error
      }

      console.log('Categoria criada:', data)
      
      toast.success(
        payload.parent_id 
          ? `Subcategoria "${formData.name}" criada com sucesso!`
          : `Categoria "${formData.name}" criada com sucesso!`
      )
      setFormData({ name: '', slug: '', description: '', parent_id: '' })
      await loadCategories()
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error)
      toast.error(error?.message || 'Erro ao criar categoria')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta categoria? Isso pode afetar os arquivos vinculados a ela.')) return

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      toast.success('Categoria excluída')
      loadCategories()
    } catch (error: any) {
      console.error('Erro ao excluir categoria:', error)
      toast.error(error?.message || 'Erro ao excluir categoria')
    }
  }

  async function openManageImages(category: Category) {
    setSelectedCategory(category)
    setIsSidebarOpen(true)
    setLoadingResources(true)
    setSelectedResources([])
    
    try {
      // Buscar todas as imagens aprovadas
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .eq('resource_type', 'image')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(200)
      
      if (resourcesError) throw resourcesError
      
      // Buscar categorias das imagens
      const resourceIds = (resourcesData || []).map(r => r.id)
      const { data: resourceCategoriesData } = await supabase
        .from('resource_categories')
        .select('resource_id, category_id')
        .in('resource_id', resourceIds)
        .eq('category_id', category.id)
      
      // Criar um Set com IDs de recursos que já têm esta categoria
      const resourcesWithCategory = new Set(
        (resourceCategoriesData || []).map((rc: any) => rc.resource_id)
      )
      
      // Marcar quais já têm esta categoria
      const resourcesWithData = (resourcesData || []).map(resource => ({
        ...resource,
        hasCategory: resourcesWithCategory.has(resource.id)
      }))
      
      setResources(resourcesWithData)
    } catch (error: any) {
      console.error('Erro ao carregar imagens:', error)
      toast.error('Erro ao carregar imagens')
    } finally {
      setLoadingResources(false)
    }
  }

  function toggleResourceSelection(resourceId: string) {
    setSelectedResources(prev => 
      prev.includes(resourceId)
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    )
  }

  async function handleAddCategoriesToResources() {
    if (!selectedCategory || selectedResources.length === 0) {
      toast.error('Selecione pelo menos uma imagem')
      return
    }

    try {
      // Preparar inserts para resource_categories
      const inserts = selectedResources.map(resourceId => ({
        resource_id: resourceId,
        category_id: selectedCategory.id
      }))

      // Verificar quais já existem para evitar duplicatas
      const { data: existing } = await supabase
        .from('resource_categories')
        .select('resource_id, category_id')
        .in('resource_id', selectedResources)
        .eq('category_id', selectedCategory.id)

      const existingSet = new Set(
        (existing || []).map((e: any) => `${e.resource_id}-${e.category_id}`)
      )

      const toInsert = inserts.filter(insert => 
        !existingSet.has(`${insert.resource_id}-${insert.category_id}`)
      )

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('resource_categories')
          .insert(toInsert)

        if (error) throw error
      }

      // Atualizar category_id principal se não tiver
      const { data: resourcesToUpdate } = await supabase
        .from('resources')
        .select('id, category_id')
        .in('id', selectedResources)
        .is('category_id', null)

      if (resourcesToUpdate && resourcesToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from('resources')
          .update({ category_id: selectedCategory.id })
          .in('id', resourcesToUpdate.map(r => r.id))

        if (updateError) {
          console.warn('Erro ao atualizar category_id principal:', updateError)
        }
      }

      toast.success(`${toInsert.length} imagem(ns) adicionada(s) à categoria "${selectedCategory.name}"`)
      setSelectedResources([])
      openManageImages(selectedCategory) // Recarregar lista
    } catch (error: any) {
      console.error('Erro ao adicionar categorias:', error)
      toast.error(error?.message || 'Erro ao adicionar categorias')
    }
  }

  const parentCategories = categories.filter(c => !c.parent_id)
  
  // Debug: log das categorias principais
  useEffect(() => {
    if (categories.length > 0) {
      console.log('📋 Categorias principais disponíveis:', {
        total: categories.length,
        principais: parentCategories.length,
        nomes: parentCategories.map(c => c.name),
        todas: categories.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id }))
      })
    }
  }, [categories, parentCategories])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Categorias</h1>
          <p className="text-gray-500 text-sm mt-1">Organize os recursos do site em seções e subcategorias.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <Card className="border-none sticky top-24">
            <h2 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-1.5">Nome</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Mockups PSD"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-1.5">
                  Categoria Pai (Opcional)
                  {parentCategories.length > 0 && (
                    <span className="ml-2 text-gray-400 font-normal normal-case">
                      ({parentCategories.length} disponível{parentCategories.length !== 1 ? 'is' : ''})
                    </span>
                  )}
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all appearance-none cursor-pointer hover:border-gray-200"
                  value={formData.parent_id}
                  onChange={(e) => {
                    console.log('Categoria pai selecionada:', e.target.value)
                    setFormData({...formData, parent_id: e.target.value})
                  }}
                  disabled={loading}
                >
                  <option value="">✓ Nenhuma (Categoria Principal)</option>
                  {loading ? (
                    <option value="" disabled>Carregando categorias...</option>
                  ) : parentCategories.length > 0 ? (
                    parentCategories.map((cat) => {
                      const subCount = categories.filter(c => c.parent_id === cat.id).length
                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                          {subCount > 0 && ` (${subCount} subcategoria${subCount !== 1 ? 's' : ''})`}
                        </option>
                      )
                    })
                  ) : (
                    <option value="" disabled>Nenhuma categoria principal disponível</option>
                  )}
                </select>
                {formData.parent_id && (
                  <p className="mt-1 text-xs text-gray-500">
                    Criando subcategoria de: <span className="font-semibold">{parentCategories.find(c => c.id === formData.parent_id)?.name}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-1.5">Slug (URL)</label>
                <input 
                  type="text"
                  placeholder="Ex: mockups-psd"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
                  value={formData.slug}
                  onChange={(e) => setFormData({...formData, slug: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-1.5">Descrição</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 rounded-xl font-bold h-12">
                Criar Categoria
              </Button>
            </form>
          </Card>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <Card className="border-none p-0 overflow-hidden">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Lista de Categorias</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="p-20 text-center text-gray-400">Carregando...</div>
              ) : categories.length > 0 ? (
                categories
                  .filter(c => !c.parent_id)
                  .map((parent) => (
                    <div key={parent.id} className="divide-y divide-gray-50">
                      {/* Parent Category */}
                      <div className="p-6 flex items-center justify-between group hover:bg-gray-50/50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                            <Layout className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900">{parent.name}</h3>
                            <p className="text-[10px] text-gray-400 font-medium">/{parent.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openManageImages(parent)}
                            className="p-2 text-gray-300 hover:text-primary-500 transition-all"
                            title="Gerenciar imagens desta categoria"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(parent.id)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Subcategories */}
                      {categories
                        .filter(c => c.parent_id === parent.id)
                        .map((sub) => (
                          <div key={sub.id} className="p-6 pl-16 flex items-center justify-between group hover:bg-gray-50/50 transition-all bg-gray-50/20">
                            <div className="flex items-center gap-4">
                              <ChevronRight className="h-4 w-4 text-gray-300" />
                              <div>
                                <h3 className="text-sm font-semibold text-gray-700">{sub.name}</h3>
                                <p className="text-[10px] text-gray-400 font-medium">/{sub.slug}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => openManageImages(sub)}
                                className="p-2 text-gray-300 hover:text-primary-500 transition-all"
                                title="Gerenciar imagens desta categoria"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(sub.id)}
                                className="p-2 text-gray-300 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))
              ) : (
                <div className="p-20 text-center text-gray-400 text-sm">Nenhuma categoria criada.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal de Gerenciar Imagens */}
      {isModalOpen && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col border-none">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Gerenciar Imagens - {selectedCategory.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Selecione as imagens para adicionar à categoria
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSidebarOpen(false)
                  setSelectedCategory(null)
                  setSelectedResources([])
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingResources ? (
                <div className="text-center py-20 text-gray-400">Carregando imagens...</div>
              ) : resources.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {resources.map((resource) => {
                      const isSelected = selectedResources.includes(resource.id)
                      const hasCategory = resource.hasCategory
                      
                      return (
                        <div
                          key={resource.id}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary-500 ring-2 ring-primary-200'
                              : hasCategory
                              ? 'border-green-300'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => toggleResourceSelection(resource.id)}
                        >
                          {resource.thumbnail_url ? (
                            <Image
                              src={getS3Url(resource.thumbnail_url)}
                              alt={resource.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          
                          {/* Checkbox overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                              <div className="bg-primary-500 rounded-full p-2">
                                <Check className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          )}
                          
                          {/* Badge se já tem categoria */}
                          {hasCategory && !isSelected && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                              Já tem
                            </div>
                          )}
                          
                          {/* Título */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs font-medium truncate">
                              {resource.title}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-gray-400">
                  Nenhuma imagem encontrada
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 p-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedResources.length > 0 ? (
                  <span className="font-semibold text-primary-600">
                    {selectedResources.length} imagem(ns) selecionada(s)
                  </span>
                ) : (
                  'Selecione as imagens acima'
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSidebarOpen(false)
                    setSelectedCategory(null)
                    setSelectedResources([])
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddCategoriesToResources}
                  disabled={selectedResources.length === 0}
                  className="bg-primary-500 hover:bg-primary-600"
                >
                  Adicionar {selectedResources.length > 0 ? `${selectedResources.length} ` : ''}à Categoria
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}


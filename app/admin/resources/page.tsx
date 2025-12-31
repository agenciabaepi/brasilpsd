'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Search, Filter, Trash2, Edit, Edit2, ExternalLink, CheckCircle2, AlertCircle, ShieldCheck, Image as ImageIcon, ChevronDown, ChevronRight, Eye, Check, X } from 'lucide-react'
import type { Resource, Category } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import { formatFileSize } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isLoadingResources, setIsLoadingResources] = useState(false)
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false)
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createSupabaseClient()
  const router = useRouter()

  const loadResources = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isLoadingResources) {
      return
    }

    setIsLoadingResources(true)
    setLoading(true)
    try {
      let query = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (categoryFilter !== 'all') {
        if (categoryFilter === 'uncategorized') {
          query = query.is('category_id', null)
        } else {
          // Se for categoria principal, incluir também subcategorias
          const category = categories.find(c => c.id === categoryFilter)
          if (category && !category.parent_id) {
            const subcategoryIds = categories
              .filter(c => c.parent_id === category.id)
              .map(c => c.id)
            query = query.in('category_id', [category.id, ...subcategoryIds])
          } else {
            query = query.eq('category_id', categoryFilter)
          }
        }
      }

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`)
      }

      const { data, error } = await query.limit(500)
      if (error) throw error
      setResources(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar recursos:', error)
      // Só mostrar erro se não for um erro de cancelamento ou múltiplas chamadas
      if (error?.message && !error.message.includes('aborted')) {
      toast.error('Erro ao carregar recursos')
      }
    } finally {
      setLoading(false)
      setIsLoadingResources(false)
    }
  }, [supabase, statusFilter, categoryFilter, searchQuery, categories, isLoadingResources])

  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('order_index', { ascending: true })
      
      if (error) throw error
      setCategories(data || [])
      
      // Categorias começam fechadas por padrão (vazio)
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    // Carregar recursos quando categorias forem carregadas ou quando filtros mudarem
    // Mas só se não precisar de categorias específicas ou se já tiver categorias carregadas
    const needsCategories = categoryFilter !== 'all' && categoryFilter !== 'uncategorized'
    if (!needsCategories || categories.length > 0) {
      loadResources()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, searchQuery, statusFilter, categories.length])

  // Agrupar recursos por categoria e resource_type
  const groupedResources = () => {
    const mainCategories = categories.filter(c => !c.parent_id).sort((a, b) => a.order_index - b.order_index)
    const uncategorized: Resource[] = []
    const grouped: Record<string, { category: Category, resources: Resource[] }> = {}
    const pngResources: Resource[] = []

    // Inicializar grupos
    mainCategories.forEach(cat => {
      grouped[cat.id] = { category: cat, resources: [] }
    })

    // Agrupar recursos
    resources.forEach(resource => {
      // Separar recursos PNG em grupo próprio
      if (resource.resource_type === 'png') {
        pngResources.push(resource)
        return
      }

      if (!resource.category_id) {
        uncategorized.push(resource)
      } else {
        const category = categories.find(c => c.id === resource.category_id)
        if (category) {
          // Se for subcategoria, agrupar na categoria principal
          const mainCategoryId = category.parent_id || category.id
          if (grouped[mainCategoryId]) {
            grouped[mainCategoryId].resources.push(resource)
          } else {
            // Se não encontrar, criar grupo para a categoria
            grouped[mainCategoryId] = { category, resources: [resource] }
          }
        } else {
          uncategorized.push(resource)
        }
      }
    })

    // Adicionar grupo especial para PNG se houver recursos (com order_index baixo para aparecer primeiro)
    if (pngResources.length > 0) {
      grouped['png'] = {
        category: {
          id: 'png',
          name: 'PNG',
          slug: 'png',
          description: 'Recursos PNG',
          icon: null,
          parent_id: null,
          order_index: -1, // Ordem negativa para aparecer antes das outras categorias
          created_at: new Date().toISOString()
        },
        resources: pngResources
      }
    }

    return { grouped, uncategorized, mainCategories }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este recurso permanentemente?\n\nEsta ação irá:\n- Deletar o arquivo do banco de dados\n- Deletar o arquivo da Amazon S3\n- Deletar o thumbnail (se existir)\n\nEsta ação NÃO pode ser desfeita!')) return

    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir recurso')
      }

      // Mostrar mensagem de sucesso
      if (data.warnings && data.warnings.length > 0) {
        console.warn('Alguns arquivos não foram deletados do S3:', data.warnings)
        toast.error(
          `Recurso deletado do banco, mas alguns arquivos do S3 não foram removidos:\n${data.warnings.join('\n')}`,
          { duration: 6000 }
        )
      } else {
        toast.success(data.message || 'Recurso excluído com sucesso (banco e S3)')
      }
      
      // Log detalhado no console
      console.log('Delete response:', {
        deletedFiles: data.deletedFiles,
        warnings: data.warnings,
        errors: data.errors
      })
      
      setResources(resources.filter(r => r.id !== id))
      setSelectedResources(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(error.message || 'Erro ao excluir recurso')
    }
  }

  async function handleBulkDelete() {
    if (selectedResources.size === 0) return

    const count = selectedResources.size
    if (!confirm(`Tem certeza que deseja excluir ${count} recurso(s) permanentemente?\n\nEsta ação irá:\n- Deletar os arquivos do banco de dados\n- Deletar os arquivos da Amazon S3\n- Deletar os thumbnails e previews (se existirem)\n\nEsta ação NÃO pode ser desfeita!`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/resources/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceIds: Array.from(selectedResources) })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir recursos')
      }

      if (data.warnings && data.warnings.length > 0) {
        toast.error(
          `${data.deleted.length} recurso(s) deletado(s), mas alguns arquivos do S3 não foram removidos.`,
          { duration: 6000 }
        )
      } else {
        toast.success(data.message || `${data.deleted.length} recurso(s) excluído(s) com sucesso`)
      }

      // Remover recursos deletados da lista
      setResources(resources.filter(r => !data.deleted.includes(r.id)))
      setSelectedResources(new Set())

      if (data.failed && data.failed.length > 0) {
        console.warn('Alguns recursos não foram deletados:', data.failed)
      }
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      toast.error(error.message || 'Erro ao excluir recursos')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleResourceSelection = (id: string) => {
    setSelectedResources(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = (resourceIds: string[]) => {
    const allSelected = resourceIds.every(id => selectedResources.has(id))
    if (allSelected) {
      setSelectedResources(prev => {
        const newSet = new Set(prev)
        resourceIds.forEach(id => newSet.delete(id))
        return newSet
      })
    } else {
      setSelectedResources(prev => {
        const newSet = new Set(prev)
        resourceIds.forEach(id => newSet.add(id))
        return newSet
      })
    }
  }

  async function handleUpdateStatus(id: string, status: 'approved' | 'rejected') {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
      toast.success(`Recurso ${status === 'approved' ? 'aprovado' : 'rejeitado'}`)
      loadResources()
    } catch (error: any) {
      toast.error('Erro ao atualizar status')
    }
  }

  async function handleGenerateThumbnails() {
    if (!confirm('Isso irá gerar thumbnails para todas as imagens que não têm thumbnail. Deseja continuar?')) {
      return
    }

    setGeneratingThumbnails(true)
    try {
      const response = await fetch('/api/admin/generate-thumbnails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, offset: 0 })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar thumbnails')
      }

      toast.success(
        `Thumbnails gerados: ${data.processed} processados, ${data.failed} falharam`,
        { duration: 5000 }
      )

      if (data.failed > 0 && data.errors && data.errors.length > 0) {
        console.warn('Erros ao gerar thumbnails:', data.errors)
      }

      // Recarregar recursos para mostrar os novos thumbnails
      loadResources()
    } catch (error: any) {
      console.error('Erro ao gerar thumbnails:', error)
      toast.error(error.message || 'Erro ao gerar thumbnails')
    } finally {
      setGeneratingThumbnails(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Biblioteca de Arquivos</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os recursos enviados para a plataforma.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedResources.size > 0 && (
            <Button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"
            >
              <Trash2 className="h-3 w-3" />
              {isDeleting ? 'Deletando...' : `Deletar Selecionados (${selectedResources.size})`}
            </Button>
          )}
          <Button 
            onClick={handleGenerateThumbnails}
            disabled={generatingThumbnails}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"
          >
            <ImageIcon className="h-3 w-3" />
            {generatingThumbnails ? 'Gerando...' : 'Gerar Thumbnails'}
          </Button>
          <Link href="/creator/upload">
            <Button className="bg-primary-500 hover:bg-primary-600 rounded-xl font-bold uppercase text-[10px] tracking-widest">
              Subir Novo Arquivo
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-none p-0 overflow-hidden">
        {/* Filters Bar */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Pesquisar por título..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadResources()}
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  statusFilter === status 
                    ? 'bg-gray-900 text-white shadow-lg' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {status === 'all' ? 'Todos' : status === 'approved' ? 'Aprovados' : status === 'pending' ? 'Pendentes' : 'Rejeitados'}
              </button>
            ))}
          </div>
        </div>
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
            >
              <option value="all">Todas as categorias</option>
              {categories.filter(c => !c.parent_id).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
              <option value="uncategorized">Sem categoria</option>
            </select>
          </div>
        </div>

        {/* Resources Organized by Category */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="px-6 py-20 text-center text-gray-400 text-sm font-medium">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
              Carregando biblioteca...
            </div>
          ) : (() => {
            const { grouped, uncategorized, mainCategories } = groupedResources()
            const hasResources = resources.length > 0

            if (!hasResources) {
              return (
                <div className="px-6 py-20 text-center text-gray-400 text-sm font-medium">
                  Nenhum recurso encontrado.
                </div>
              )
            }

            return (
              <>
                {/* Renderizar grupo PNG primeiro se existir */}
                {grouped['png'] && (() => {
                  const pngGroup = grouped['png']
                  const pngResources = pngGroup.resources || []
                  const isPngExpanded = expandedCategories.has('png')
                  
                  return (
                    <div key="png" className="border-b border-gray-100 last:border-b-0">
                      <button
                        onClick={() => toggleCategory('png')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isPngExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm font-bold text-gray-900">PNG</span>
                          <span className="text-xs text-gray-400 font-medium">({pngResources.length})</span>
                        </div>
                      </button>
                      
                      {isPngExpanded && pngResources.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-3 w-12">
                                  <input
                                    type="checkbox"
                                    checked={pngResources.length > 0 && pngResources.every(r => selectedResources.has(r.id))}
                                    onChange={() => toggleSelectAll(pngResources.map(r => r.id))}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recurso</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Autor</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo/Tamanho</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {pngResources.map((resource) => (
                                <tr key={resource.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-6 py-4">
                                    <input
                                      type="checkbox"
                                      checked={selectedResources.has(resource.id)}
                                      onChange={() => toggleResourceSelection(resource.id)}
                                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                      <div className={`h-12 w-12 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-checkerboard`}>
                                        {resource.thumbnail_url && (
                                          <img src={getS3Url(resource.thumbnail_url)} className="h-full w-full object-cover" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{resource.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {resource.is_premium && <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Premium</span>}
                                          {resource.is_official && <span className="text-[8px] font-bold text-primary-500 uppercase tracking-widest">Oficial</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-600">
                                        {resource.is_official ? 'BrasilPSD' : (resource.creator?.full_name || 'Desconhecido')}
                                      </span>
                                      {resource.is_official && <CheckCircle2 className="h-3 w-3 text-primary-500 fill-primary-500" />}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-gray-900 uppercase tracking-tighter">PNG</span>
                                      <span className="text-[10px] text-gray-400">{formatFileSize(resource.file_size)}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                      resource.status === 'approved' ? 'bg-primary-50 text-gray-900' :
                                      resource.status === 'pending' ? 'bg-yellow-50 text-gray-900' :
                                      'bg-red-50 text-gray-900'
                                    }`}>
                                      {resource.status === 'approved' ? 'Aprovado' : resource.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <Link href={`/resources/${resource.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </Link>
                                      <Link href={`/admin/resources/edit/${resource.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                      </Link>
                                      {resource.status === 'pending' && (
                                        <>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 text-primary-600 hover:text-primary-700"
                                            onClick={() => handleUpdateStatus(resource.id, 'approved')}
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                            onClick={() => handleUpdateStatus(resource.id, 'rejected')}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        onClick={() => handleDelete(resource.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })()}
                
                {mainCategories.map(category => {
                  const group = grouped[category.id]
                  const categoryResources = group?.resources || []
                  const isExpanded = expandedCategories.has(category.id)
                  
                  if (categoryFilter !== 'all' && categoryFilter !== category.id && !categoryResources.length) {
                    return null
                  }

                  return (
                    <div key={category.id} className="border-b border-gray-100 last:border-b-0">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm font-bold text-gray-900">{category.name}</span>
                          <span className="text-xs text-gray-400 font-medium">({categoryResources.length})</span>
                        </div>
                      </button>
                      
                      {isExpanded && categoryResources.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-3 w-12">
                                  <input
                                    type="checkbox"
                                    checked={categoryResources.length > 0 && categoryResources.every(r => selectedResources.has(r.id))}
                                    onChange={() => toggleSelectAll(categoryResources.map(r => r.id))}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recurso</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Autor</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo/Tamanho</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                              {categoryResources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedResources.has(resource.id)}
                        onChange={() => toggleResourceSelection(resource.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 ${resource.file_format?.toLowerCase() === 'png' ? 'bg-checkerboard' : 'bg-gray-100'}`}>
                          {resource.thumbnail_url && (
                            <img src={getS3Url(resource.thumbnail_url)} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{resource.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {resource.is_premium && <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Premium</span>}
                            {resource.is_official && <span className="text-[8px] font-bold text-primary-500 uppercase tracking-widest">Oficial</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">
                          {resource.is_official ? 'BrasilPSD' : (resource.creator?.full_name || 'Desconhecido')}
                        </span>
                        {resource.is_official && <CheckCircle2 className="h-3 w-3 text-primary-500 fill-primary-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-tighter">{resource.resource_type}</span>
                        <span className="text-[10px] text-gray-400">{formatFileSize(resource.file_size)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        resource.status === 'approved' ? 'bg-primary-50 text-gray-900' :
                        resource.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {resource.status === 'approved' ? 'Ativo' : resource.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {resource.status === 'pending' && (
                          <button 
                            onClick={() => handleUpdateStatus(resource.id, 'approved')}
                            className="p-2 text-gray-700 hover:bg-primary-50 rounded-lg transition-all"
                            title="Aprovar"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <Link href={`/creator/resources/edit/${resource.id}`} target="_blank">
                          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Editar">
                            <Edit className="h-4 w-4" />
                          </button>
                        </Link>
                        <Link href={`/resources/${resource.id}`} target="_blank">
                          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Ver no site">
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </Link>
                        <button 
                          onClick={() => handleDelete(resource.id)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {uncategorized.length > 0 && (categoryFilter === 'all' || categoryFilter === 'uncategorized') && (
                  <div className="border-b border-gray-100">
                    <button
                      onClick={() => toggleCategory('uncategorized')}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expandedCategories.has('uncategorized') ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm font-bold text-gray-900">Sem Categoria</span>
                        <span className="text-xs text-gray-400 font-medium">({uncategorized.length})</span>
                      </div>
                    </button>
                    
                    {expandedCategories.has('uncategorized') && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-6 py-3 w-12">
                                <input
                                  type="checkbox"
                                  checked={uncategorized.length > 0 && uncategorized.every(r => selectedResources.has(r.id))}
                                  onChange={() => toggleSelectAll(uncategorized.map(r => r.id))}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                              </th>
                              <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recurso</th>
                              <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Autor</th>
                              <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo/Tamanho</th>
                              <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {uncategorized.map((resource) => (
                              <tr key={resource.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    checked={selectedResources.has(resource.id)}
                                    onChange={() => toggleResourceSelection(resource.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 ${resource.file_format?.toLowerCase() === 'png' ? 'bg-checkerboard' : 'bg-gray-100'}`}>
                                      {resource.thumbnail_url && (
                                        <img src={getS3Url(resource.thumbnail_url)} className="h-full w-full object-cover" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{resource.title}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {resource.is_premium && <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Premium</span>}
                                        {resource.is_official && <span className="text-[8px] font-bold text-primary-500 uppercase tracking-widest">Oficial</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-600">
                                      {resource.is_official ? 'BrasilPSD' : (resource.creator?.full_name || 'Desconhecido')}
                                    </span>
                                    {resource.is_official && <CheckCircle2 className="h-3 w-3 text-primary-500 fill-primary-500" />}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-900 uppercase tracking-tighter">{resource.resource_type}</span>
                                    <span className="text-[10px] text-gray-400">{formatFileSize(resource.file_size)}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                    resource.status === 'approved' ? 'bg-primary-50 text-gray-900' :
                                    resource.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                    'bg-red-50 text-red-600'
                                  }`}>
                                    {resource.status === 'approved' ? 'Ativo' : resource.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {resource.status === 'pending' && (
                                      <button 
                                        onClick={() => handleUpdateStatus(resource.id, 'approved')}
                                        className="p-2 text-gray-700 hover:bg-primary-50 rounded-lg transition-all"
                                        title="Aprovar"
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </button>
                                    )}
                                    <Link href={`/creator/resources/edit/${resource.id}`} target="_blank">
                                      <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Editar">
                                        <Edit className="h-4 w-4" />
                                      </button>
                                    </Link>
                                    <Link href={`/resources/${resource.id}`} target="_blank">
                                      <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Ver no site">
                                        <ExternalLink className="h-4 w-4" />
                                      </button>
                                    </Link>
                                    <button 
                                      onClick={() => handleDelete(resource.id)}
                                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                                      title="Excluir"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                  </td>
                </tr>
                            ))}
            </tbody>
          </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </Card>
    </div>
  )
}


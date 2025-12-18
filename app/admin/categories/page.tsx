'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit, Layout, Tag as TagIcon, ChevronRight } from 'lucide-react'
import type { Category } from '@/types/database'
import toast from 'react-hot-toast'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsSidebarOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', parent_id: '' })
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
      setCategories(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
        description: formData.description,
        parent_id: formData.parent_id || null
      }

      const { error } = await supabase
        .from('categories')
        .insert([payload])
      
      if (error) throw error
      toast.success('Categoria criada com sucesso')
      setFormData({ name: '', slug: '', description: '', parent_id: '' })
      loadCategories()
    } catch (error: any) {
      toast.error('Erro ao criar categoria')
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
      toast.error('Erro ao excluir categoria')
    }
  }

  const parentCategories = categories.filter(c => !c.parent_id)

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
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-1.5">Categoria Pai (Opcional)</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all appearance-none"
                  value={formData.parent_id}
                  onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                >
                  <option value="">Nenhuma (Categoria Principal)</option>
                  {parentCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
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
    </div>
  )
}


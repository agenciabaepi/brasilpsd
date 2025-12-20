'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function NewCollectionPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: '',
    is_premium: false,
    is_featured: false
  })

  useEffect(() => {
    // Gerar slug automaticamente a partir do título
    if (formData.title) {
      const slug = formData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }, [formData.title])


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('Título é obrigatório')
      return
    }

    setLoading(true)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Não autorizado')
        router.push('/login')
        return
      }

      // Criar coleção
      const { data: collection, error } = await supabase
        .from('collections')
        .insert({
          creator_id: user.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          slug: formData.slug.trim(),
          is_premium: formData.is_premium,
          is_featured: formData.is_featured,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Coleção criada com sucesso!')
      router.push(`/creator/collections/${collection.id}/edit`)
    } catch (error: any) {
      console.error('Erro ao criar coleção:', error)
      toast.error(error.message || 'Erro ao criar coleção')
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8">Nova Coleção</h1>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Título */}
            <Input
              label="Título da Coleção *"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Templates de Social Media"
              required
            />

            {/* Slug */}
            <div>
              <Input
                label="URL Amigável (Slug)"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="templates-social-media"
              />
              <p className="mt-1 text-sm text-gray-500">Gerado automaticamente a partir do título. Você pode personalizar.</p>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva sua coleção..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Opções Premium e Exclusivo */}
            <div className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
              <label className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.is_premium}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_premium: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors duration-200 ease-in-out ${
                    formData.is_premium ? 'bg-primary-500' : 'bg-gray-300'
                  }`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transform transition-transform duration-200 ease-in-out ${
                    formData.is_premium ? 'translate-x-6' : 'translate-x-0'
                  }`}></div>
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Premium</div>
                  <div className="text-sm text-gray-500">Coleção premium requer assinatura</div>
                </div>
              </label>

              <label className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors duration-200 ease-in-out ${
                    formData.is_featured ? 'bg-primary-500' : 'bg-gray-300'
                  }`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transform transition-transform duration-200 ease-in-out ${
                    formData.is_featured ? 'translate-x-6' : 'translate-x-0'
                  }`}></div>
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Exclusivo</div>
                  <div className="text-sm text-gray-500">Destacar esta coleção como exclusiva</div>
                </div>
              </label>
            </div>

            {/* Botões */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                className="flex-1"
              >
                {loading ? 'Criando...' : 'Criar Coleção'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}


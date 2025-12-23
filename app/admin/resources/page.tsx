'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Search, Filter, Trash2, Edit, ExternalLink, CheckCircle2, AlertCircle, ShieldCheck, Image as ImageIcon } from 'lucide-react'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import { formatFileSize } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false)
  const supabase = createSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    loadResources()
  }, [statusFilter])

  async function loadResources() {
    setLoading(true)
    try {
      let query = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`)
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      setResources(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar recursos')
    } finally {
      setLoading(false)
    }
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
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(error.message || 'Erro ao excluir recurso')
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
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4">
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

        {/* Resources Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recurso</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Autor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo/Tamanho</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 text-sm font-medium">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    Carregando biblioteca...
                  </td>
                </tr>
              ) : resources.length > 0 ? (
                resources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
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
                        resource.status === 'approved' ? 'bg-green-50 text-gray-900' :
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
                            className="p-2 text-gray-700 hover:bg-green-50 rounded-lg transition-all"
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
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 text-sm font-medium">
                    Nenhum recurso encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


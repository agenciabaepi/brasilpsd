'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { 
  Files, 
  Search, 
  Edit2, 
  Trash2, 
  Eye, 
  Download,
  Filter,
  Upload,
  MoreVertical,
  Plus,
  Play
} from 'lucide-react'
import type { Resource } from '@/types/database'
import Link from 'next/link'
import { getS3Url } from '@/lib/aws/s3'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function CreatorResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createSupabaseClient()

  const loadResources = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setResources(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar seus arquivos')
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este arquivo permanentemente?\n\nEsta ação irá:\n- Deletar o arquivo do banco de dados\n- Deletar o arquivo da Amazon S3\n- Deletar o thumbnail e preview (se existirem)\n\nEsta ação NÃO pode ser desfeita!')) {
      return
    }

    try {
      const response = await fetch(`/api/creator/resources/${id}`, {
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
      toast.error(error.message || 'Erro ao excluir arquivo')
    }
  }

  const filteredResources = resources.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Meus Arquivos</h1>
          <p className="text-gray-500 font-medium">Gerencie e edite seus recursos enviados.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/creator/upload">
            <Button className="bg-primary-500 hover:bg-primary-600 h-12 px-6 rounded-xl font-semibold space-x-2">
              <Plus className="h-5 w-5" />
              <span>Novo Upload</span>
            </Button>
          </Link>
          <Link href="/creator/upload/batch">
            <Button variant="outline" className="h-12 px-6 rounded-xl font-semibold space-x-2">
              <Upload className="h-5 w-5" />
              <span>Upload em Lote</span>
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-none p-0 overflow-hidden">
        {/* Filtros e Busca */}
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar nos meus arquivos..."
              className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="h-12 px-4 border border-gray-100 rounded-xl flex items-center space-x-2 text-gray-600 hover:bg-gray-50 transition-all">
            <Filter className="h-5 w-5" />
            <span className="text-sm font-semibold">Filtros</span>
          </button>
        </div>

        {/* Tabela de Arquivos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Arquivo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Downloads</th>
                <th className="px-6 py-4 text-center">Views</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-8 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredResources.length > 0 ? (
                filteredResources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-4">
                        <div 
                          className="h-12 w-12 rounded-lg bg-gray-100 border border-gray-100 overflow-hidden flex-shrink-0 relative"
                          onMouseEnter={() => {
                            if (resource.resource_type === 'video') {
                              setHoveredVideoId(resource.id)
                            }
                          }}
                          onMouseLeave={() => {
                            if (resource.resource_type === 'video') {
                              setHoveredVideoId(null)
                            }
                          }}
                        >
                          {resource.resource_type === 'video' && (resource.preview_url || resource.file_url) ? (
                            <>
                              {/* Thumbnail - sempre visível quando não está em hover */}
                              {resource.thumbnail_url ? (
                                <Image
                                  src={getS3Url(resource.thumbnail_url)}
                                  alt={resource.title}
                                  width={48}
                                  height={48}
                                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                                    hoveredVideoId === resource.id ? 'opacity-0' : 'opacity-100'
                                  }`}
                                  unoptimized
                                />
                              ) : (
                                <video
                                  src={(resource.preview_url ? getS3Url(resource.preview_url) : getS3Url(resource.file_url)) + '#t=0.001'}
                                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                                    hoveredVideoId === resource.id ? 'opacity-0' : 'opacity-100'
                                  }`}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  onLoadedData={(e) => {
                                    e.currentTarget.currentTime = 0.001
                                    e.currentTarget.pause()
                                  }}
                                  onContextMenu={(e) => e.preventDefault()}
                                  onDragStart={(e) => e.preventDefault()}
                                  draggable={false}
                                />
                              )}
                              {/* Vídeo - aparece apenas no hover */}
                              <video
                                src={(resource.preview_url ? getS3Url(resource.preview_url) : getS3Url(resource.file_url)) + '#t=0.001'}
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                                  hoveredVideoId === resource.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                                }`}
                                muted
                                loop
                                playsInline
                                preload="none"
                                controlsList="nodownload noplaybackrate nofullscreen"
                                disablePictureInPicture
                                disableRemotePlayback
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return false
                                }}
                                onDragStart={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return false
                                }}
                                style={{
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none',
                                  pointerEvents: hoveredVideoId === resource.id ? 'auto' : 'none'
                                }}
                                ref={(video) => {
                                  if (video && hoveredVideoId === resource.id) {
                                    video.play().catch(() => {})
                                  } else if (video && hoveredVideoId !== resource.id) {
                                    video.pause()
                                    video.currentTime = 0
                                  }
                                }}
                              />
                              {hoveredVideoId !== resource.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20 pointer-events-none">
                                  <div className="bg-white/90 rounded-full p-1.5 shadow-lg">
                                    <Play className="h-3 w-3 text-gray-900 fill-gray-900 ml-0.5" />
                                  </div>
                                </div>
                              )}
                            </>
                          ) : resource.thumbnail_url ? (
                            <Image
                              src={getS3Url(resource.thumbnail_url)}
                              alt={resource.title}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-300">
                              <Files className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{resource.title}</p>
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tight">{resource.resource_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-tight ${
                        resource.status === 'approved' ? 'bg-green-50 text-gray-900' :
                        resource.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {resource.status === 'approved' ? 'Aprovado' :
                         resource.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center space-x-1 text-gray-600">
                        <Download className="h-3 w-3" />
                        <span className="text-sm font-semibold">{resource.download_count}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center space-x-1 text-gray-600">
                        <Eye className="h-3 w-3" />
                        <span className="text-sm font-semibold">{resource.view_count}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-medium text-gray-500">
                        {new Date(resource.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all"
                          onClick={() => router.push(`/creator/resources/edit/${resource.id}`)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          onClick={() => handleDelete(resource.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="h-12 w-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                        <Files className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-500 font-medium">Nenhum arquivo encontrado.</p>
                      <Link href="/creator/upload">
                        <Button variant="ghost" className="text-primary-500 font-semibold uppercase text-[10px] tracking-widest">
                          Fazer meu primeiro upload
                        </Button>
                      </Link>
                    </div>
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


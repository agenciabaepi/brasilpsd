'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Download, Resource, Profile } from '@/types/database'
import { 
  Download as DownloadIcon, 
  Calendar, 
  RefreshCw,
  Info,
  CheckCircle2,
  FileText,
  Video,
  Image as ImageIcon,
  Music,
  FileImage,
  Package
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { formatPlanName, getDownloadLimitByPlan } from '@/lib/utils/download-helpers'
import { cn } from '@/lib/utils/cn'

// Função para gerar ID de licença único baseado no download
function generateLicenseId(downloadId: string, downloadedAt: string): string {
  // Usar timestamp e ID do download para criar um número único
  const timestamp = new Date(downloadedAt).getTime()
  const idHash = downloadId.split('-').join('').substring(0, 10)
  const timestampStr = timestamp.toString().slice(-15)
  return `#${timestampStr}${idHash}`
}

// Função para obter ícone e label do tipo de recurso
function getResourceTypeInfo(resourceType: string) {
  const types: Record<string, { icon: typeof Package, label: string }> = {
    video: { icon: Video, label: 'MOTION' },
    image: { icon: ImageIcon, label: 'FILE' },
    png: { icon: FileImage, label: 'FILE' },
    font: { icon: FileText, label: 'FILE' },
    psd: { icon: FileText, label: 'FILE' },
    ai: { icon: FileText, label: 'FILE' },
    audio: { icon: Music, label: 'AUDIO' },
    other: { icon: Package, label: 'FILE' }
  }
  return types[resourceType] || types.other
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<Download[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<{
    current: number
    limit: number
    remaining: number
    plan: string
  } | null>(null)
  const [user, setUser] = useState<Profile | null>(null)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    await Promise.all([loadDownloads(), loadDownloadStatus()])
  }

  async function loadDownloads() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }

      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      setUser(profile)

      const { data, error } = await supabase
        .from('downloads')
        .select(`
          *,
          resource:resources(
            *,
            creator:profiles!creator_id(id, full_name, avatar_url),
            category:categories!category_id(id, name, slug)
          )
        `)
        .eq('user_id', authUser.id)
        .order('downloaded_at', { ascending: false })

      if (error) throw error
      setDownloads(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar downloads:', error)
      toast.error('Erro ao carregar downloads')
    } finally {
      setLoading(false)
    }
  }

  async function loadDownloadStatus() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const response = await fetch('/api/downloads/status')
      if (response.ok) {
        const status = await response.json()
        setDownloadStatus(status)
      }
    } catch (error) {
      console.error('Erro ao carregar status de downloads:', error)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('Downloads atualizados')
  }

  // Filtrar apenas downloads com recursos válidos
  const validDownloads = useMemo(() => {
    return downloads.filter(d => d.resource)
  }, [downloads])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando histórico de downloads...</p>
        </div>
      </div>
    )
  }

  const planName = user?.subscription_tier ? formatPlanName(user.subscription_tier) : 'Grátis'
  const limit = downloadStatus?.limit || getDownloadLimitByPlan(user?.subscription_tier || 'free')
  const current = downloadStatus?.current || 0
  const remaining = downloadStatus?.remaining || Math.max(0, limit - current)

  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Histórico de downloads</h1>
            <p className="text-gray-600">
              Veja o histórico de downloads e acesse seus recursos gráficos anteriores.
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Barra de Estatísticas */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Info className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-gray-600">Downloads hoje</span>
              <span className="font-semibold text-gray-900">{current} / {limit}</span>
            </div>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Restantes</span>
              <span className="font-semibold text-gray-900">{remaining}</span>
            </div>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Plano</span>
              <span className="font-semibold text-blue-600">{planName}</span>
            </div>
          </div>
        </div>

        {/* Banner de Informações Importantes */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-primary-900 mb-1">Informação importante!</h3>
              <p className="text-sm text-primary-800">
                Se você baixar o mesmo arquivo várias vezes no mesmo dia, ele contará apenas como um download. 
                No entanto, se você atingir o limite de downloads, não poderá baixar mais nenhum arquivo, mesmo que tenha baixado o mesmo arquivo naquele dia. 
                Se você baixar um arquivo que já foi baixado no dia anterior, será considerado um novo download.
              </p>
            </div>
          </div>
        </div>

        {/* Tabela de Downloads */}
        {validDownloads.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arquivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Licença
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {validDownloads.map((download) => {
                    if (!download.resource) return null
                    const resource = download.resource
                    const downloadDate = new Date(download.downloaded_at)
                    const licenseId = generateLicenseId(download.id, download.downloaded_at)
                    const typeInfo = getResourceTypeInfo(resource.resource_type)
                    const TypeIcon = typeInfo.icon

                    return (
                      <tr key={download.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Link 
                              href={`/resources/${resource.id}`}
                              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 group"
                            >
                              {resource.thumbnail_url ? (
                                <img
                                  src={resource.thumbnail_url.startsWith('http') 
                                    ? resource.thumbnail_url 
                                    : `/api/image/${resource.thumbnail_url}?q=75`}
                                  alt={resource.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <TypeIcon className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link 
                                href={`/resources/${resource.id}`}
                                className="block"
                              >
                                <p className="text-sm font-medium text-gray-900 truncate hover:text-primary-600 transition-colors">
                                  {resource.title}
                                </p>
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  {typeInfo.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(licenseId)
                              toast.success('ID da licença copiado!')
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                          >
                            {licenseId}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {format(downloadDate, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                            <span className="text-sm text-gray-900">Concluído</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <DownloadIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-2">Você ainda não fez nenhum download</p>
            <Link
              href="/explore"
              className="text-primary-600 hover:text-primary-700 font-medium inline-block mt-2"
            >
              Explorar recursos
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}

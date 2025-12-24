'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Download } from '@/types/database'
import { Download as DownloadIcon, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { getS3Url } from '@/lib/aws/s3'
import Card from '@/components/ui/Card'
import toast from 'react-hot-toast'

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<Download[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadDownloads()
  }, [])

  async function loadDownloads() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('downloads')
        .select('*, resource:resources(*)')
        .eq('user_id', user.id)
        .order('downloaded_at', { ascending: false })

      if (error) throw error
      setDownloads(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar downloads')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Meus Downloads</h1>
          <p className="text-gray-600">
            {downloads.length} {downloads.length === 1 ? 'download realizado' : 'downloads realizados'}
          </p>
        </div>

        {downloads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {downloads.map((download) => (
              download.resource && (
                <Card key={download.id} className="p-6">
                  <div className="space-y-4">
                    {download.resource.thumbnail_url && (
                      <div className="relative h-48 w-full rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={getS3Url(download.resource.thumbnail_url)}
                          alt={download.resource.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {download.resource.title}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(download.downloaded_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <DownloadIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-4">Você ainda não fez nenhum download</p>
            <a
              href="/explore"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Explorar recursos
            </a>
          </Card>
        )}
      </div>
    </div>
  )
}


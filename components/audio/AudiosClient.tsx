'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import AudioPlayer from './AudioPlayer'
import type { Resource } from '@/types/database'
import { Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface AudiosClientProps {
  initialAudios: (Resource & { creator?: any })[]
}

export default function AudiosClient({ initialAudios }: AudiosClientProps) {
  const [audios, setAudios] = useState<(Resource & { creator?: any })[]>(initialAudios)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const supabase = createSupabaseClient()
  const router = useRouter()

  // Carregar favoritos do usuário
  useEffect(() => {
    async function loadFavorites() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('favorites')
        .select('resource_id')
        .eq('user_id', user.id)

      if (data) {
        setFavorites(new Set(data.map(f => f.resource_id)))
      }
    }

    loadFavorites()
  }, [supabase])

  // Buscar áudios
  const searchAudios = useCallback(async () => {
    if (!searchQuery.trim()) {
      setAudios(initialAudios)
      return
    }

    setLoading(true)
    try {
      let query = supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .eq('resource_type', 'audio')

      // Buscar por título ou palavras-chave
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,keywords.cs.{${searchQuery}}`)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setAudios(data || [])
    } catch (error: any) {
      console.error('Error searching audios:', error)
      toast.error('Erro ao buscar áudios')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, supabase, initialAudios])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchAudios()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchAudios])

  const handleFavorite = async (resourceId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Faça login para favoritar áudios')
      router.push('/login')
      return
    }

    const isFavorited = favorites.has(resourceId)

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('resource_id', resourceId)

        if (error) throw error
        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(resourceId)
          return newSet
        })
        toast.success('Removido dos favoritos')
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            resource_id: resourceId
          })

        if (error) throw error
        setFavorites(prev => new Set(prev).add(resourceId))
        toast.success('Adicionado aos favoritos')
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error)
      toast.error('Erro ao atualizar favoritos')
    }
  }

  const handleDownload = async (resource: Resource) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Faça login para baixar áudios')
      router.push('/login')
      return
    }

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao baixar')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resource.title}.${resource.file_format || 'mp3'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Download iniciado!')
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error(error.message || 'Erro ao baixar áudio')
    }
  }

  const getArtistName = (resource: Resource & { creator?: any }) => {
    if (resource.is_official) {
      return 'BrasilPSD'
    }
    return resource.creator?.full_name || 'Desconhecido'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Biblioteca de Áudios</h1>
          <p className="text-gray-600">Explore nossa coleção de efeitos sonoros e músicas</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar áudios..."
              className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="h-12 px-4 border border-gray-200 rounded-xl flex items-center space-x-2 text-gray-600 hover:bg-white transition-all">
            <Filter className="h-5 w-5" />
            <span className="text-sm font-semibold">Filtros</span>
          </button>
        </div>

        {/* Audio List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
              <p className="mt-4 text-gray-500">Buscando áudios...</p>
            </div>
          ) : audios.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum áudio encontrado</p>
            </div>
          ) : (
            audios.map((audio) => (
              <AudioPlayer
                key={audio.id}
                audioUrl={audio.file_url}
                previewUrl={audio.preview_url}
                title={audio.title}
                artist={getArtistName(audio)}
                duration={audio.duration || undefined}
                resourceId={audio.id}
                isDownloadable={true}
                onDownload={() => handleDownload(audio)}
                onFavorite={() => handleFavorite(audio.id)}
                isFavorited={favorites.has(audio.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}


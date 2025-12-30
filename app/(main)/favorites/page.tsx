'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ResourceCard from '@/components/resources/ResourceCard'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Favorite } from '@/types/database'
import { Maximize2, Minimize2 } from 'lucide-react'
import toast from 'react-hot-toast'
import GridALicious from '@/components/layout/GridALicious'

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  // Tamanho de exibição: 'small' ou 'large' (padrão: 'large')
  const [imageSize, setImageSize] = useState<'small' | 'large'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('imageDisplaySize')
      return (saved === 'large' || saved === 'small') ? saved : 'large'
    }
    return 'large'
  })
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Salvar preferência no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('imageDisplaySize', imageSize)
    }
  }, [imageSize])

  useEffect(() => {
    loadFavorites()
  }, [])

  async function loadFavorites() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('*, resource:resources(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFavorites(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar favoritos')
    } finally {
      setLoading(false)
    }
  }

  async function handleUnfavorite(resourceId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)

    if (!error) {
      setFavorites(prev => prev.filter(f => f.resource_id !== resourceId))
      toast.success('Removido dos favoritos')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Meus Favoritos</h1>
            <p className="text-gray-600">
              {favorites.length} {favorites.length === 1 ? 'recurso favoritado' : 'recursos favoritados'}
            </p>
          </div>
          
          {/* Controle de Tamanho */}
          {favorites.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-1">
              <button
                onClick={() => setImageSize('small')}
                className={`p-2 rounded-lg transition-all ${
                  imageSize === 'small'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Imagens menores"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setImageSize('large')}
                className={`p-2 rounded-lg transition-all ${
                  imageSize === 'large'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Imagens maiores"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {favorites.length > 0 ? (
          <>
            {/* Mobile: Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-1 lg:hidden">
              {favorites.map((favorite) => (
                favorite.resource && (
                  <ResourceCard
                    key={favorite.id}
                    resource={favorite.resource}
                    onFavorite={handleUnfavorite}
                    isFavorited={true}
                  />
                )
              ))}
            </div>
            {/* Desktop: Grid-A-Licious Layout */}
            <div className="hidden lg:block">
              <GridALicious imageSize={imageSize}>
                {favorites.map((favorite) => (
                  favorite.resource && (
                    <ResourceCard
                      key={favorite.id}
                      resource={favorite.resource}
                      onFavorite={handleUnfavorite}
                      isFavorited={true}
                    />
                  )
                ))}
              </GridALicious>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-lg text-gray-600 mb-4">Você ainda não tem favoritos</p>
            <Link
              href="/explore"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Explorar recursos
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}


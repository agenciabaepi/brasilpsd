'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Favorite, Resource } from '@/types/database'
import toast from 'react-hot-toast'
import JustifiedGrid from '@/components/layout/JustifiedGrid'

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createSupabaseClient()

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Meus Favoritos</h1>
          <p className="text-gray-600">
            {favorites.length} {favorites.length === 1 ? 'recurso favoritado' : 'recursos favoritados'}
          </p>
        </div>

        {favorites.length > 0 ? (
          <JustifiedGrid 
            resources={favorites.map(f => f.resource).filter((r): r is Resource => r !== null && r !== undefined)}
            rowHeight={240}
            margin={4}
          />
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


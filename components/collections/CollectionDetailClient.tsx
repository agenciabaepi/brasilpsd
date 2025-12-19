'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { ArrowLeft, Download, Heart, Share2, User, Calendar } from 'lucide-react'
import Button from '@/components/ui/Button'
import ResourceCard from '@/components/resources/ResourceCard'
import type { Collection, Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface CollectionDetailClientProps {
  collection: Collection
  resources: Resource[]
}

export default function CollectionDetailClient({ collection, resources }: CollectionDetailClientProps) {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [isFavorited, setIsFavorited] = useState(false)

  async function handleFavorite() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Implementar favoritar coleção (se necessário)
    // Por enquanto, apenas toggle visual
    setIsFavorited(!isFavorited)
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: collection.title,
        text: collection.description || '',
        url: window.location.href
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copiado para a área de transferência!')
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Banner da Coleção */}
      <div className="relative h-64 md:h-96 bg-gradient-to-br from-primary-50 to-gray-50">
        <div className="w-full h-full bg-gradient-to-br from-primary-100 to-gray-100" />
        <div className="absolute inset-0 bg-black/10" />
        
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="container mx-auto max-w-6xl">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            <h1 className="text-4xl md:text-5xl font-semibold text-white mb-4 drop-shadow-lg">
              {collection.title}
            </h1>
            
            {collection.description && (
              <p className="text-lg text-white/90 mb-6 max-w-3xl drop-shadow">
                {collection.description}
              </p>
            )}

            <div className="flex items-center gap-6 text-white/90">
              <Link 
                href={`/creator/${collection.creator_id}`}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                {collection.creator?.avatar_url ? (
                  <Image
                    src={getS3Url(collection.creator.avatar_url)}
                    alt={collection.creator.full_name || ''}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <User className="h-8 w-8" />
                )}
                <span className="font-medium">{collection.creator?.full_name || 'Criador'}</span>
              </Link>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {format(new Date(collection.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">{resources.length} recursos</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">{collection.view_count || 0} visualizações</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Ações */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleFavorite}
                className={isFavorited ? 'text-red-500 border-red-500' : ''}
              >
                <Heart className={`h-4 w-4 mr-2 ${isFavorited ? 'fill-red-500' : ''}`} />
                Favoritar
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recursos da Coleção */}
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">
          Recursos da Coleção ({resources.length})
        </h2>

        {resources.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">Esta coleção ainda não possui recursos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
            {resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


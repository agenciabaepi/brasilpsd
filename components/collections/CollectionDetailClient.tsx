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
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-b border-gray-800">
        {/* Preview de recursos no background */}
        {resources.length > 0 && (
          <div className="absolute inset-0 opacity-20 overflow-hidden">
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 h-full p-4">
              {resources.slice(0, 16).map((resource, index) => (
                resource.thumbnail_url ? (
                  <div key={resource.id || index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={getS3Url(resource.thumbnail_url)}
                      alt={resource.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 25vw, 12.5vw"
                    />
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}
        
        <div className="relative z-10">
          <div className="container mx-auto max-w-6xl px-4 pt-8 pb-12">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-6 text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
              {/* Informações da coleção */}
              <div className="lg:col-span-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-3 md:mb-4 drop-shadow-lg">
                  {collection.title}
                </h1>
                
                {collection.description && (
                  <p className="text-base sm:text-lg text-white/90 mb-4 md:mb-6 max-w-3xl drop-shadow">
                    {collection.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-white/80 text-sm sm:text-base">
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
                      <User className="h-6 w-6" />
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
                    <span className="text-sm font-medium">{resources.length} recursos</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm">{collection.view_count || 0} visualizações</span>
                  </div>
                </div>
              </div>

              {/* Preview grid dos recursos */}
              {resources.length > 0 && (
                <div className="lg:col-span-1">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {resources.slice(0, 4).map((resource, index) => (
                        resource.thumbnail_url ? (
                          <Link
                            key={resource.id || index}
                            href={`/resources/${resource.id}`}
                            className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-primary-500 transition-all group"
                          >
                            <Image
                              src={getS3Url(resource.thumbnail_url)}
                              alt={resource.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 1024px) 50vw, 25vw"
                            />
                          </Link>
                        ) : (
                          <div key={index} className="aspect-square rounded-lg bg-gray-50 flex items-center justify-center">
                            <span className="text-gray-300 text-xs">Sem prévia</span>
                          </div>
                        )
                      ))}
                      {resources.length < 4 && (
                        Array.from({ length: 4 - resources.length }).map((_, i) => (
                          <div key={`empty-${i}`} className="aspect-square rounded-lg bg-white/10" />
                        ))
                      )}
                    </div>
                    {resources.length > 4 && (
                      <p className="text-xs text-white/70 text-center mt-3">
                        +{resources.length - 4} mais recursos
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Ações */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 py-3 sm:py-4">
          <div className="flex items-center justify-center sm:justify-start">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFavorite}
                className={isFavorited ? 'text-red-500 border-red-500' : ''}
              >
                <Heart className={`h-4 w-4 sm:mr-2 ${isFavorited ? 'fill-red-500' : ''}`} />
                <span className="hidden sm:inline">Favoritar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Compartilhar</span>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
            {resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


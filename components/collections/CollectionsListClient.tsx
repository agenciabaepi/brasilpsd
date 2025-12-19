'use client'

import { useState } from 'react'
import { Search, Image as ImageIcon, FileText, Crown } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import type { Collection, Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'
import Link from 'next/link'

interface CollectionsListClientProps {
  collections: (Collection & { preview_resources?: Resource[] })[]
}

export default function CollectionsListClient({ collections: initialCollections }: CollectionsListClientProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCollections = initialCollections.filter(collection =>
    collection.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.creator?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Banner Hero */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50/30 border-b border-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-gray-900 tracking-tight">
              Explore <span className="text-primary-500 font-bold">Coleções</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Descubra coleções temáticas criadas por nossa comunidade de criadores
            </p>
            
            {/* Barra de Busca */}
            <div className="max-w-2xl mx-auto mt-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar coleções..."
                  className="pl-12 h-14 text-base"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lista de Coleções */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {/* Header com Contadores */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Todas as Coleções
            </h2>
            <p className="text-gray-600">
              {filteredCollections.length} {filteredCollections.length === 1 ? 'coleção encontrada' : 'coleções encontradas'}
            </p>
          </div>

          {/* Lista de Coleções com Recursos */}
          {filteredCollections.length === 0 ? (
            <Card className="p-12 text-center">
              <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Nenhuma coleção encontrada' : 'Nenhuma coleção disponível'}
              </h3>
              <p className="text-gray-600">
                {searchQuery 
                  ? 'Tente buscar com outros termos' 
                  : 'Ainda não há coleções públicas disponíveis'}
              </p>
            </Card>
          ) : (
            <div className="space-y-12">
              {filteredCollections.map((collection) => (
                <div key={collection.id} className="space-y-4">
                  {/* Header da Coleção */}
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/collections/${collection.id}`}>
                        <h3 className="text-2xl font-bold text-gray-900 hover:text-primary-600 transition-colors mb-2">
                          {collection.title}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium">
                          {collection.resources_count || 0} arquivos
                        </span>
                        <span className="text-gray-400">•</span>
                        <span>Formato {collection.preview_resources?.[0]?.file_format?.toUpperCase() || 'PSD'}</span>
                      </div>
                    </div>
                    <Link href={`/collections/${collection.id}`}>
                      <Button variant="outline" size="sm">
                        Ver coleção completa
                      </Button>
                    </Link>
                  </div>

                  {/* Recursos da Coleção */}
                  {collection.preview_resources && collection.preview_resources.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {collection.preview_resources.map((resource) => (
                        <Link key={resource.id} href={`/resources/${resource.id}`}>
                          <div className="group relative overflow-hidden rounded-xl bg-gray-100 border border-gray-100 hover:border-primary-200 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer">
                            <div className="relative w-full aspect-square overflow-hidden">
                              {resource.thumbnail_url ? (
                                <Image
                                  src={getS3Url(resource.thumbnail_url)}
                                  alt={resource.title}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <FileText className="h-12 w-12 text-gray-300" />
                                </div>
                              )}
                              {resource.is_premium && (
                                <div className="absolute top-2 right-2 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-lg shadow-lg border border-white/10">
                                  <Crown className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm">Esta coleção ainda não possui recursos</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}


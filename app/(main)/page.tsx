import { Search, TrendingUp, Star, Download, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import HomeClient from '@/components/home/HomeClient'
import Image from 'next/image'
import SearchBar from '@/components/home/SearchBar'
import UserStatsBar from '@/components/home/UserStatsBar'
import { getS3Url } from '@/lib/aws/s3'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

  // 1. Destaques (Oficiais)
  const { data: officialResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('is_official', true)
    .order('created_at', { ascending: false })
    .limit(50)

  // 2. Exclusivos (Mais baixados ou Premium)
  const { data: popularResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('is_premium', true)
    .order('download_count', { ascending: false })
    .limit(50)

  // 3. Novos (Comunidade)
  const { data: latestResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  // 4. Grátis
  const { data: freeResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('is_premium', false)
    .order('created_at', { ascending: false })
    .limit(50)

  // 5. Coleções (com últimos 4 recursos)
  const { data: collections } = await supabase
    .from('collections')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(12)

  // Buscar últimos 4 recursos de cada coleção
  const collectionsWithResources = await Promise.all(
    (collections || []).map(async (collection: any) => {
      const { data: collectionResources } = await supabase
        .from('collection_resources')
        .select(`
          *,
          resource:resources!resource_id(*, creator:profiles!creator_id(*))
        `)
        .eq('collection_id', collection.id)
        .order('order_index', { ascending: true })
        .limit(4)

      const resources = (collectionResources || [])
        .map((cr: any) => cr.resource)
        .filter((r: any) => r && r.status === 'approved')

      const { count } = await supabase
        .from('collection_resources')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collection.id)

      return {
        ...collection,
        preview_resources: resources,
        resources_count: count || 0
      }
    })
  )

  // 6. Categorias Dinâmicas
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('order_index', { ascending: true })
    .limit(12)

  // Buscar alguns usuários com avatares para exibir na barra de estatísticas
  const { data: userAvatars } = await supabase
    .from('profiles')
    .select('avatar_url, full_name')
    .not('avatar_url', 'is', null)
    .limit(3)

  // Processar URLs dos avatares no servidor
  const processedAvatars = (userAvatars || []).map(user => ({
    avatar_url: user.avatar_url ? getS3Url(user.avatar_url) : null,
    full_name: user.full_name
  }))

  return (
    <div className="bg-white">
      {/* Hero Section Simplificada (Estilo Designi) */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50/30 border-b border-gray-50 py-16 overflow-visible">
        {/* SVG Banner Lines com opacidade aumentada */}
        <div className="absolute inset-0 opacity-[0.18] overflow-hidden">
          <Image
            src="/images/bannerlines.svg"
            alt=""
            fill
            className="object-cover"
            priority
            aria-hidden="true"
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8 relative">
            <UserStatsBar userAvatars={processedAvatars} />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-gray-900 tracking-tight">
              Recursos para sua <span className="text-primary-500 font-bold">criatividade.</span>
            </h1>
            
            {/* Search Bar com tipo de arquivo e botão integrado */}
            <div className="relative" style={{ zIndex: 100 }}>
              <SearchBar />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {['Social Media', 'Mockups', 'Flyers', 'Logotipos'].map(tag => (
                <Link key={tag} href={`/explore?q=${tag}`}>
                  <span className="px-4 py-1.5 bg-white/90 backdrop-blur-sm text-gray-700 rounded-full text-xs font-medium hover:bg-primary-50 hover:text-primary-600 transition-all border border-gray-200 shadow-sm">
                    {tag}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Section (Destaques, Exclusivos, Novos, Grátis) */}
      <HomeClient 
        officialResources={officialResources || []}
        popularResources={popularResources || []}
        latestResources={latestResources || []}
        freeResources={freeResources || []}
      />

      {/* Collections Section */}
      {collectionsWithResources && collectionsWithResources.length > 0 && (
        <section className="py-20 bg-white border-t border-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Coleções</h2>
              <Link href="/collections" className="text-primary-500 text-xs font-bold uppercase tracking-widest hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {collectionsWithResources.map((collection: any) => (
                <Link key={collection.id} href={`/collections/${collection.id}`} className="group">
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-primary-200 hover:shadow-lg transition-all">
                    {/* Grid 2x2 de recursos */}
                    {collection.preview_resources && collection.preview_resources.length > 0 ? (
                      <div className="grid grid-cols-2 gap-0">
                        {collection.preview_resources.map((resource: any, index: number) => (
                          <div key={resource.id} className="aspect-square relative overflow-hidden bg-gray-100">
                            {resource.thumbnail_url ? (
                              <Image
                                src={getS3Url(resource.thumbnail_url)}
                                alt={resource.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="(max-width: 640px) 50vw, 25vw"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                <span className="text-gray-300 text-xs">Sem prévia</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Preencher espaços vazios se tiver menos de 4 recursos */}
                        {collection.preview_resources.length < 4 && (
                          Array.from({ length: 4 - collection.preview_resources.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square bg-gray-50" />
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Sem recursos</span>
                      </div>
                    )}
                    
                    {/* Footer com título e info */}
                    <div className="p-4 border-t border-gray-50">
                      <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {collection.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{collection.resources_count || 0} arquivos</span>
                        <span>Formato {collection.preview_resources?.[0]?.file_format?.toUpperCase() || 'PSD'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories Bar */}
      {categories && categories.length > 0 && (
        <section className="py-20 bg-gray-50/30 border-t border-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Explorar Categorias</h2>
              <Link href="/categories" className="text-primary-500 text-xs font-bold uppercase tracking-widest hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <Link key={category.id} href={`/categories/${category.slug}`}>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center hover:border-primary-500 hover:shadow-lg hover:shadow-primary-500/5 transition-all group">
                    <h3 className="text-sm font-semibold text-gray-700 group-hover:text-primary-600 transition-colors">
                      {category.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div className="text-center space-y-4">
              <div className="h-14 w-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto">
                <Download className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Acesso Ilimitado</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">Baixe o que precisar para seus projetos, sem limites diários de download.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="h-14 w-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Curadoria Elite</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">Arquivos revisados manualmente para garantir máxima qualidade e organização.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="h-14 w-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Sempre Atualizado</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">Novos templates e elementos adicionados diariamente por nossa comunidade.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-primary-50 text-primary-600">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900">
        {title}
      </h3>
      <p className="text-gray-500 leading-relaxed max-w-xs mx-auto text-sm font-medium">
        {description}
      </p>
    </div>
  )
}


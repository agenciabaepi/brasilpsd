import { Search, TrendingUp, Star, Download, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import HomeClient from '@/components/home/HomeClient'
import Image from 'next/image'
import SearchBar from '@/components/home/SearchBar'
import UserStatsBar from '@/components/home/UserStatsBar'
import CategoryCarousel from '@/components/home/CategoryCarousel'
import { getS3Url } from '@/lib/aws/s3'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

  // 1. Destaques (Oficiais) - excluindo fontes e áudios
  const { data: officialResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('is_official', true)
    .neq('resource_type', 'font')
    .neq('resource_type', 'audio')
    .order('created_at', { ascending: false })
    .limit(50)

  // 2. Exclusivos (Mais baixados ou Premium) - excluindo fontes e áudios
  const { data: popularResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('is_premium', true)
    .neq('resource_type', 'font')
    .neq('resource_type', 'audio')
    .order('download_count', { ascending: false })
    .limit(50)

  // 3. Novos (Comunidade) - excluindo fontes e áudios
  const { data: latestResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .neq('resource_type', 'font')
    .neq('resource_type', 'audio')
    .order('created_at', { ascending: false })
    .limit(50)

  // 4. Grátis - excluindo fontes e áudios
  const { data: freeResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('is_premium', false)
    .neq('resource_type', 'font')
    .neq('resource_type', 'audio')
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

  // 6. Buscar categorias principais para os cards (Mockups, PSDs, Vídeos, Fontes, Áudios)
  // Buscar todas as categorias principais primeiro
  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .is('parent_id', null)
  
  // Mapear categorias encontradas por slug/nome
  const categoryMap = new Map<string, any>()
  allCategories?.forEach(cat => {
    const slugLower = cat.slug.toLowerCase()
    const nameLower = cat.name.toLowerCase()
    
    // Mapear por slug
    if (slugLower.includes('mockup')) categoryMap.set('mockups', cat)
    if (slugLower.includes('psd') || slugLower === 'psd') categoryMap.set('psd', cat)
    if (slugLower.includes('video') || slugLower === 'videos') categoryMap.set('videos', cat)
    if (slugLower.includes('fonte') || slugLower === 'fontes' || slugLower === 'fonts') categoryMap.set('fontes', cat)
    if (slugLower.includes('audio') || slugLower === 'audios' || slugLower === 'áudios') categoryMap.set('audios', cat)
    
    // Mapear por nome também
    if (nameLower.includes('mockup')) categoryMap.set('mockups', cat)
    if (nameLower.includes('psd')) categoryMap.set('psd', cat)
    if (nameLower.includes('vídeo') || nameLower.includes('video')) categoryMap.set('videos', cat)
    if (nameLower.includes('fonte')) categoryMap.set('fontes', cat)
    if (nameLower.includes('áudio') || nameLower.includes('audio')) categoryMap.set('audios', cat)
  })
  
  // Definir categorias padrão (sempre exibir 5)
  const mainCategories = [
    {
      id: categoryMap.get('mockups')?.id || null,
      name: categoryMap.get('mockups')?.name || 'Mockups',
      slug: categoryMap.get('mockups')?.slug || 'mockups'
    },
    {
      id: categoryMap.get('psd')?.id || null,
      name: categoryMap.get('psd')?.name || 'PSDs',
      slug: categoryMap.get('psd')?.slug || 'psd'
    },
    {
      id: categoryMap.get('videos')?.id || null,
      name: categoryMap.get('videos')?.name || 'Vídeos',
      slug: categoryMap.get('videos')?.slug || 'videos'
    },
    {
      id: categoryMap.get('fontes')?.id || null,
      name: categoryMap.get('fontes')?.name || 'Fontes',
      slug: categoryMap.get('fontes')?.slug || 'fontes'
    },
    {
      id: categoryMap.get('audios')?.id || null,
      name: categoryMap.get('audios')?.name || 'Áudios',
      slug: categoryMap.get('audios')?.slug || 'audios'
    }
  ]

  // 7. Categorias Dinâmicas para a seção final
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('order_index', { ascending: true })
    .limit(12)

  // Buscar alguns usuários com avatares para exibir na barra de estatísticas
  let processedAvatars: Array<{ avatar_url: string | null; full_name: string | null }> = []
  
  try {
    const { data: userAvatars } = await supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .not('avatar_url', 'is', null)
      .limit(3)

    // Processar URLs dos avatares no servidor
    processedAvatars = (userAvatars || []).map(user => {
      if (!user || !user.avatar_url) {
        return { avatar_url: null, full_name: user?.full_name || null }
      }
      
      let avatarUrl = user.avatar_url
      // Se a URL não começar com http, processar com getS3Url
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        try {
          avatarUrl = getS3Url(avatarUrl)
        } catch (error) {
          console.error('Erro ao processar URL do avatar:', error)
          avatarUrl = user.avatar_url // Usar original em caso de erro
        }
      }
      return {
        avatar_url: avatarUrl,
        full_name: user.full_name
      }
    })
  } catch (error) {
    console.error('Erro ao buscar avatares de usuários:', error)
    // Se houver erro, processedAvatars permanece vazio e o componente usará placeholders
  }

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

      {/* Categories Quick Access */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4">
          {/* Mobile: Carrossel com scroll automático */}
          <div className="md:hidden">
            <CategoryCarousel categories={mainCategories} />
          </div>

          {/* Desktop: Grid normal */}
          <div className="hidden md:grid md:grid-cols-5 gap-4">
            {mainCategories.map((category, index) => {
              const slugLower = (category.slug?.toLowerCase() || '').trim()
              const nameLower = (category.name?.toLowerCase() || '').trim()

              // Determinar tipo por slug ou nome ou ordem
              let categoryType = 'default'
              if (slugLower === 'mockups' || slugLower.includes('mockup') || nameLower.includes('mockup')) {
                categoryType = 'mockups'
              } else if (slugLower === 'psd' || slugLower.includes('psd') || nameLower.includes('psd')) {
                categoryType = 'psd'
              } else if (slugLower === 'videos' || slugLower.includes('video') || nameLower.includes('vídeo') || nameLower.includes('video')) {
                categoryType = 'videos'
              } else if (slugLower === 'fontes' || slugLower === 'fonts' || slugLower.includes('fonte') || nameLower.includes('fonte')) {
                categoryType = 'fontes'
              } else if (slugLower === 'audios' || slugLower === 'áudios' || slugLower.includes('audio') || nameLower.includes('áudio') || nameLower.includes('audio')) {
                categoryType = 'audios'
              } else {
                const types = ['mockups', 'psd', 'videos', 'fontes', 'audios']
                categoryType = types[index] || 'default'
              }

              // Renderizar ícone baseado no tipo
              let iconElement
              let gradientClass

              if (categoryType === 'mockups') {
                gradientClass = 'from-green-400 to-green-600'
                iconElement = null
              } else if (categoryType === 'psd') {
                gradientClass = 'from-blue-400 to-blue-600'
                iconElement = (
                  <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">PS</span>
                    </div>
                  </div>
                )
              } else if (categoryType === 'videos') {
                gradientClass = 'from-purple-400 to-purple-600'
                iconElement = (
                  <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-md relative overflow-hidden">
                      <div className="w-0 h-0 border-l-[10px] border-l-white border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent ml-0.5"></div>
                    </div>
                  </div>
                )
              } else if (categoryType === 'fontes') {
                gradientClass = 'from-pink-400 to-pink-600'
                iconElement = (
                  <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
                    <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-700 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">Aa</span>
                    </div>
                  </div>
                )
              } else if (categoryType === 'audios') {
                gradientClass = 'from-orange-400 to-orange-600'
                iconElement = (
                  <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center shadow-md relative px-2">
                      <div className="flex space-x-1 items-end">
                        <div className="w-1 bg-white rounded-full h-3"></div>
                        <div className="w-1 bg-white rounded-full h-4"></div>
                        <div className="w-1 bg-white rounded-full h-2.5"></div>
                      </div>
                    </div>
                  </div>
                )
              } else {
                gradientClass = 'from-gray-400 to-gray-600'
                iconElement = (
                  <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-700 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">?</span>
                    </div>
                  </div>
                )
              }

              return (
                <CategoryCard
                  key={category.id}
                  title={category.name}
                  href={`/categories/${category.slug}`}
                  icon={
                    categoryType === 'mockups' ? null : (
                      <div className={`w-24 h-24 bg-gradient-to-br ${gradientClass} rounded-3xl flex items-center justify-center shadow-xl`}>
                        {iconElement}
                      </div>
                    )
                  }
                  backgroundImage={categoryType === 'mockups' ? '/images/mockup.jpg' : undefined}
                  hoverImage={categoryType === 'mockups' ? '/images/mockup-verso.jpg' : undefined}
                  showTitle={categoryType !== 'mockups'}
                />
              )
            })}
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

function CategoryCard({ title, href, icon, backgroundImage, hoverImage, showTitle = true }: { title: string, href: string, icon: any, backgroundImage?: string, hoverImage?: string, showTitle?: boolean }) {
  return (
    <Link href={href} className="group block aspect-square">
      <div className={`rounded-3xl border border-gray-200 p-6 hover:border-primary-300 transition-all w-full h-full aspect-square flex flex-col relative overflow-hidden ${backgroundImage ? '' : 'bg-white hover:shadow-xl'}`}>
        {backgroundImage && (
          <>
            <Image
              src={backgroundImage}
              alt={title}
              fill
              className="object-cover transition-opacity duration-300 group-hover:opacity-0"
              sizes="(max-width: 768px) 50vw, 20vw"
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={title}
                fill
                className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                sizes="(max-width: 768px) 50vw, 20vw"
              />
            )}
          </>
        )}
        <div className={`relative z-10 flex flex-col h-full ${backgroundImage ? 'text-white' : ''}`}>
          {icon && (
            <div className="mb-6 flex justify-center">
              {icon}
            </div>
          )}
          {showTitle && (
            <h3 className={`text-lg font-bold mb-8 group-hover:text-primary-300 transition-colors ${backgroundImage ? 'text-white' : 'text-gray-900 group-hover:text-primary-600'}`}>
              {title}
            </h3>
          )}
          {!showTitle && !icon && (
            <div className="flex-1" />
          )}
          <div className={showTitle ? 'mt-auto' : 'mt-auto flex justify-start'}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-900 group-hover:bg-primary-600 transition-colors shadow-md">
              <ChevronRight className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </Link>
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


import { createServerSupabaseClient } from '@/lib/supabase/server'
import ExploreClient from '@/components/explore/ExploreClient'
import VideosHero from '@/components/categories/VideosHero'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface CategoryPageProps {
  params: {
    slug: string
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const supabase = createServerSupabaseClient()
  
  // 1. Busca a categoria pelo slug
  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!category) {
    return notFound()
  }

  // 2. Busca recursos iniciais desta categoria
  const { data: initialResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('category_id', category.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Verificar se é a categoria de vídeos (por slug ou nome)
  const slugLower = category.slug?.toLowerCase() || ''
  const nameLower = category.name?.toLowerCase() || ''
  const isVideosCategory = 
    slugLower.includes('video') || 
    slugLower === 'videos' ||
    nameLower.includes('vídeo') || 
    nameLower.includes('video')

  return (
    <>
      {isVideosCategory && <VideosHero />}
      <ExploreClient 
        initialResources={initialResources || []} 
        initialCategoryId={category.id}
        categoryName={category.name}
        hasHero={isVideosCategory}
      />
    </>
  )
}


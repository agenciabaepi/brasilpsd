import { createServerSupabaseClient } from '@/lib/supabase/server'
import ExploreClient from '@/components/explore/ExploreClient'

export const dynamic = 'force-dynamic'

interface ExplorePageProps {
  searchParams: { type?: string; q?: string }
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const supabase = createServerSupabaseClient()
  const typeFilter = searchParams?.type
  
  // Se houver filtro de tipo, mostrar apenas recursos daquele tipo (modo legado)
  if (typeFilter) {
    const { data: initialResources } = await supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', typeFilter)
      .order('created_at', { ascending: false })
      .limit(50)

    const typeLabels: Record<string, string> = {
      video: 'Banco de Vídeo',
      motion: 'Modelos de Vídeo',
      audio: 'Músicas',
      psd: 'PSDs',
      image: 'Imagens',
      font: 'Fontes',
    }

    return (
      <ExploreClient 
        initialResources={initialResources || []} 
        categoryName={typeLabels[typeFilter] || 'Recursos'}
        initialFormatFilter={typeFilter}
      />
    )
  }
  
  // Buscar categorias para mapear tipos de recursos para slugs
  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .is('parent_id', null)
  
  // Mapear categorias por nome/slug para tipos de recursos
  const categoryMap = new Map<string, string>()
  allCategories?.forEach(cat => {
    const slugLower = cat.slug?.toLowerCase() || ''
    const nameLower = cat.name?.toLowerCase() || ''
    
    if (slugLower.includes('video') || nameLower.includes('vídeo') || nameLower.includes('video')) {
      if (!slugLower.includes('modelo') && !nameLower.includes('modelo')) {
        categoryMap.set('video', cat.slug)
      }
    }
    if (slugLower.includes('motion') || slugLower.includes('modelo') || nameLower.includes('modelo') || nameLower.includes('motion')) {
      categoryMap.set('motion', cat.slug)
    }
    if (slugLower.includes('audio') || slugLower === 'audios' || slugLower === 'áudios' || nameLower.includes('áudio') || nameLower.includes('audio') || nameLower.includes('música')) {
      categoryMap.set('audio', cat.slug)
    }
    if (slugLower.includes('psd') || slugLower === 'psd' || nameLower.includes('psd')) {
      categoryMap.set('psd', cat.slug)
    }
    if (slugLower.includes('imagem') || slugLower.includes('image') || nameLower.includes('imagem') || nameLower.includes('image')) {
      categoryMap.set('image', cat.slug)
    }
    if (slugLower.includes('fonte') || slugLower === 'fontes' || slugLower === 'fonts' || nameLower.includes('fonte')) {
      categoryMap.set('font', cat.slug)
    }
  })

  // Caso contrário, mostrar seções por categoria
  const [videosResult, motionResult, audioResult, psdResult, imageResult, fontResult] = await Promise.all([
    // Vídeos (Banco de Vídeo)
    supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', 'video')
      .order('created_at', { ascending: false })
      .limit(8),
    
    // Motions (Modelos de Vídeo)
    supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', 'motion')
      .order('created_at', { ascending: false })
      .limit(8),
    
    // Áudios (Músicas)
    supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', 'audio')
      .order('created_at', { ascending: false })
      .limit(8),
    
    // PSDs
    supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', 'psd')
      .order('created_at', { ascending: false })
      .limit(8),
    
    // Imagens
    supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', 'image')
      .order('created_at', { ascending: false })
      .limit(8),
    
    // Fontes
    supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', 'font')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const categoryResources = {
    video: videosResult.data || [],
    motion: motionResult.data || [],
    audio: audioResult.data || [],
    psd: psdResult.data || [],
    image: imageResult.data || [],
    font: fontResult.data || [],
  }

  const categorySlugs = {
    video: categoryMap.get('video') || 'videos',
    motion: categoryMap.get('motion') || 'modelos-de-video',
    audio: categoryMap.get('audio') || 'audios',
    psd: categoryMap.get('psd') || 'psds',
    image: categoryMap.get('image') || 'imagens',
    font: categoryMap.get('font') || 'fontes',
  }

  return <ExploreClient categoryResources={categoryResources} categorySlugs={categorySlugs} />
}

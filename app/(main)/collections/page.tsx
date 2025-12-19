import { createServerSupabaseClient } from '@/lib/supabase/server'
import CollectionsListClient from '@/components/collections/CollectionsListClient'
import type { Collection } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const supabase = createServerSupabaseClient()

  // Buscar todas as coleções aprovadas
  const { data: collections, error } = await supabase
    .from('collections')
    .select(`
      *,
      creator:profiles!creator_id(*)
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao carregar coleções:', error)
  }

  // Buscar contagem e últimos 4 recursos para cada coleção
  const collectionsWithResources = await Promise.all(
    (collections || []).map(async (collection: any) => {
      const { count } = await supabase
        .from('collection_resources')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collection.id)

      // Buscar últimos 4 recursos da coleção
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

      return {
        ...collection,
        resources_count: count || 0,
        preview_resources: resources
      }
    })
  )

  return <CollectionsListClient collections={collectionsWithResources as any[]} />
}


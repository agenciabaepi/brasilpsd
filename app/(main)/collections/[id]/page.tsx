import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CollectionDetailClient from '@/components/collections/CollectionDetailClient'
import type { Collection } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function CollectionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  
  // Buscar coleção
  const { data: collection, error } = await supabase
    .from('collections')
    .select('*, creator:profiles!creator_id(*)')
    .eq('id', params.id)
    .single()

  if (error || !collection) {
    notFound()
  }

  // Verificar se está aprovada ou se é o criador
  if (collection.status !== 'approved') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || collection.creator_id !== user.id) {
      notFound()
    }
  }

  // Incrementar visualização
  await supabase.rpc('increment', {
    table_name: 'collections',
    column_name: 'view_count',
    row_id: collection.id,
  })

  // Buscar recursos da coleção
  const { data: collectionResources } = await supabase
    .from('collection_resources')
    .select(`
      *,
      resource:resources!resource_id(*, creator:profiles!creator_id(*))
    `)
    .eq('collection_id', collection.id)
    .order('order_index', { ascending: true })

  const resources = (collectionResources || [])
    .map((cr: any) => cr.resource)
    .filter(Boolean)

  return <CollectionDetailClient collection={collection as Collection} resources={resources} />
}


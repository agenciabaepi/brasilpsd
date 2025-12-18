import { createServerSupabaseClient } from '@/lib/supabase/server'
import ResourceDetailClient from '@/components/resources/ResourceDetailClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ResourceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  
  // Busca o recurso no servidor
  const { data: resource, error } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('id', params.id)
    .single()

  if (error || !resource) {
    notFound()
  }

  // Verifica se está aprovado ou se é o criador/admin
  if (resource.status !== 'approved') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || (resource.creator_id !== user.id && !user)) {
      notFound()
    }
  }

  // Incrementa visualização (pode ser feito em background ou via RPC)
  await supabase.rpc('increment', {
    table_name: 'resources',
    column_name: 'view_count',
    row_id: resource.id,
  })

  // Verifica se o usuário logado favoritou o recurso
  let initialIsFavorited = false
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    const { data: favorite } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('resource_id', params.id)
      .single()
    initialIsFavorited = !!favorite
  }

  return <ResourceDetailClient resource={resource} initialIsFavorited={initialIsFavorited} />
}

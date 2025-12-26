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

  // Buscar perfil do usuário e verificar favorito
  let initialUser = null
  let initialIsFavorited = false
  let initialDownloadStatus = null
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    // Buscar perfil completo do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    initialUser = profile || null

    // Verificar se favoritou
    const { data: favorite } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('resource_id', params.id)
      .single()
    initialIsFavorited = !!favorite

    // Buscar status de downloads no servidor (para exibir imediatamente no botão)
    try {
      // Usar a função helper que conta corretamente
      const { getDownloadStatus } = await import('@/lib/utils/downloads')
      const downloadStatusData = await getDownloadStatus(authUser.id)
      
      if (downloadStatusData) {
        initialDownloadStatus = {
          current: downloadStatusData.current || 0,
          limit: downloadStatusData.limit || 0,
          remaining: downloadStatusData.remaining || 0,
          allowed: downloadStatusData.allowed || false
        }
      }
    } catch (error) {
      // Silenciar erro - o cliente vai buscar depois se necessário
      console.error('Error fetching initial download status:', error)
    }
  }

  // Buscar coleções que contêm este recurso
  let collection = null
  let collectionResources = []
  
  // Buscar qual coleção este recurso pertence
  const { data: collectionResourceList, error: collectionResourceError } = await supabase
    .from('collection_resources')
    .select('collection_id')
    .eq('resource_id', params.id)
    .limit(1)

  const collectionResourceData = collectionResourceList?.[0]

  if (collectionResourceData?.collection_id) {
    // Buscar dados da coleção (apenas se estiver aprovada)
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select('*, creator:profiles!creator_id(*)')
      .eq('id', collectionResourceData.collection_id)
      .eq('status', 'approved')
      .maybeSingle()

    if (collectionData && !collectionError) {
      collection = collectionData
      
      // Buscar os outros recursos da mesma coleção
      const { data: otherCollectionResources, error: otherResourcesError } = await supabase
        .from('collection_resources')
        .select('resource_id, order_index')
        .eq('collection_id', collection.id)
        .neq('resource_id', params.id) // Excluir o recurso atual
        .order('order_index', { ascending: true })
        .limit(6) // Limitar a 6 recursos para exibição

      if (otherCollectionResources && otherCollectionResources.length > 0 && !otherResourcesError) {
        // Buscar os recursos em uma query separada
        const resourceIds = otherCollectionResources.map((cr: any) => cr.resource_id)
        
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('resources')
          .select('*, creator:profiles!creator_id(*)')
          .in('id', resourceIds)
          .eq('status', 'approved')

        if (resourcesData && !resourcesError) {
          // Manter a ordem baseada em order_index
          const resourceMap = new Map(resourcesData.map((r: any) => [r.id, r]))
          collectionResources = otherCollectionResources
            .map((cr: any) => resourceMap.get(cr.resource_id))
            .filter(Boolean)
        }
      }
    }
  }

  // Buscar recursos relacionados (mesma categoria primeiro, depois mesmo tipo)
  let relatedResources = []
  
  // Tentar buscar por categoria primeiro
  if (resource.category_id) {
    const { data: categoryResources } = await supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('category_id', resource.category_id)
      .neq('id', params.id)
      .order('view_count', { ascending: false })
      .limit(8)

    if (categoryResources && categoryResources.length > 0) {
      relatedResources = categoryResources
    }
  }

  // Se não encontrou recursos suficientes por categoria, buscar por tipo
  if (relatedResources.length < 8 && resource.resource_type) {
    const remaining = 8 - relatedResources.length
    const existingIds = relatedResources.map(r => r.id).concat(params.id)
    
    // Buscar por tipo, excluindo os que já foram encontrados
    const { data: typeResources } = await supabase
      .from('resources')
      .select('*, creator:profiles!creator_id(*)')
      .eq('status', 'approved')
      .eq('resource_type', resource.resource_type)
      .neq('id', params.id)
      .order('view_count', { ascending: false })
      .limit(remaining + existingIds.length) // Buscar um pouco mais para filtrar

    if (typeResources && typeResources.length > 0) {
      // Filtrar recursos que já estão na lista
      const newResources = typeResources.filter((r: any) => !existingIds.includes(r.id))
      relatedResources = [...relatedResources, ...newResources].slice(0, 8)
    }
  }

  return (
    <ResourceDetailClient 
      resource={resource} 
      initialUser={initialUser}
      initialIsFavorited={initialIsFavorited}
      initialDownloadStatus={initialDownloadStatus}
      collection={collection}
      collectionResources={collectionResources}
      relatedResources={relatedResources}
    />
  )
}

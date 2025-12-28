import { createServerSupabaseClient } from '@/lib/supabase/server'
import ExploreClient from '@/components/explore/ExploreClient'

export const dynamic = 'force-dynamic'

export default async function PNGPage() {
  const supabase = createServerSupabaseClient()
  
  // Buscar recursos PNG aprovados
  const { data: initialResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('resource_type', 'png')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <ExploreClient 
      initialResources={initialResources || []} 
      categoryName="PNG"
      initialFormatFilter="png"
    />
  )
}


import { createServerSupabaseClient } from '@/lib/supabase/server'
import FontsClient from '@/components/fonts/FontsClient'

export const dynamic = 'force-dynamic'

export default async function FontsPage() {
  const supabase = createServerSupabaseClient()
  
  // Buscar apenas fontes aprovadas
  const { data: initialResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('resource_type', 'font')
    .order('created_at', { ascending: false })
    .limit(50)

  // Buscar categorias
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .order('name')

  return <FontsClient initialResources={initialResources || []} categories={categories || []} />
}


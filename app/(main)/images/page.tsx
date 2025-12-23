import { createServerSupabaseClient } from '@/lib/supabase/server'
import ImagesClient from '@/components/images/ImagesClient'

export const dynamic = 'force-dynamic'

export default async function ImagesPage() {
  const supabase = createServerSupabaseClient()
  
  // Buscar apenas imagens aprovadas
  const { data: initialResources } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('resource_type', 'image')
    .order('created_at', { ascending: false })
    .limit(50)

  // Buscar categorias
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .order('name')

  return <ImagesClient initialResources={initialResources || []} categories={categories || []} />
}


import { createServerSupabaseClient } from '@/lib/supabase/server'
import AudiosClient from '@/components/audio/AudiosClient'

export const dynamic = 'force-dynamic'

export default async function AudiosPage() {
  const supabase = createServerSupabaseClient()
  
  // Buscar áudios aprovados
  const { data: initialAudios } = await supabase
    .from('resources')
    .select('*, creator:profiles!creator_id(*)')
    .eq('status', 'approved')
    .eq('resource_type', 'audio')
    .order('created_at', { ascending: false })
    .limit(50)

  return <AudiosClient initialAudios={initialAudios || []} />
}


import { createServerSupabaseClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) {
    redirect('/login')
  }

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()
  
  if (!profile) {
    redirect('/login')
  }

  // Load downloads
  const { data: downloadsData } = await supabase
    .from('downloads')
    .select('*, resource:resources(*)')
    .eq('user_id', authUser.id)
    .order('downloaded_at', { ascending: false })
    .limit(10)

  // Load favorites
  const { data: favoritesData } = await supabase
    .from('favorites')
    .select('*, resource:resources(*)')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate stats
  const { count: downloadsCount } = await supabase
    .from('downloads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', authUser.id)

  const { count: favoritesCount } = await supabase
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', authUser.id)

  const stats = {
    totalDownloads: downloadsCount || 0,
    totalFavorites: favoritesCount || 0,
    recentDownloads: downloadsData?.length || 0,
  }

  return (
    <DashboardClient 
      user={profile} 
      downloads={downloadsData || []} 
      favorites={favoritesData || []} 
      stats={stats} 
    />
  )
}

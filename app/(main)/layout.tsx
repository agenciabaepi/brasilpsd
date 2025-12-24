import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Usar dynamic para garantir que a sessão seja verificada, mas com cache otimizado
export const dynamic = 'force-dynamic'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  
  // Busca o usuário na sessão (no servidor)
  const { data: { session } } = await supabase.auth.getSession()
  
  let profile = null
  let initialSubscription = null
  
  if (session?.user) {
    const [profileResult, subscriptionResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])
    
    profile = profileResult.data
    initialSubscription = subscriptionResult.data
  }

  // Busca categorias para o menu
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('order_index', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="flex min-h-screen flex-col">
      <Header 
        initialUser={profile} 
        initialSubscription={initialSubscription}
        initialCategories={categories || []} 
      />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import PromotionalBar from '@/components/layout/PromotionalBar'
import HeaderSpacer from '@/components/layout/HeaderSpacer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkAndUpdateSubscriptionStatusClient } from '@/lib/utils/subscription-check'

// Usar dynamic para garantir que a sessão seja verificada, mas com cache otimizado
export const dynamic = 'force-dynamic'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  
  // Busca o usuário autenticado (no servidor) - usando getUser() para segurança
  const { data: { user } } = await supabase.auth.getUser()
  
  let profile = null
  let initialSubscription = null
  
  if (user) {
    // Verificar e atualizar status da assinatura antes de buscar dados
    const serverSupabase = createServerSupabaseClient()
    const { isActive, subscription: activeSub } = await checkAndUpdateSubscriptionStatusClient(user.id, serverSupabase)
    
    const [profileResult, subscriptionResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])
    
    profile = profileResult.data
    // Usar a assinatura ativa encontrada pela verificação, ou a do banco
    initialSubscription = activeSub || subscriptionResult.data
  }

  // Busca categorias para o menu
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('order_index', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="flex min-h-screen flex-col">
      {/* Espaçador dinâmico que ajusta quando o header está oculto */}
      <HeaderSpacer />
      <PromotionalBar />
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

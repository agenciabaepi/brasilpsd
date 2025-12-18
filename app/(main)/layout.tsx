import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  
  // Busca o usuário na sessão (no servidor)
  const { data: { session } } = await supabase.auth.getSession()
  
  let profile = null
  if (session?.user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    profile = data
  }

  // Busca categorias para o menu
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('order_index', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="flex min-h-screen flex-col">
      <Header initialUser={profile} initialCategories={categories || []} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

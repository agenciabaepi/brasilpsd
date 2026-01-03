'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { User, Heart, Upload, Menu, X, ChevronDown, Moon, Crown, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import toast from 'react-hot-toast'
import { checkAndUpdateSubscriptionStatusClient } from '@/lib/utils/subscription-check'

interface HeaderProps {
  initialUser?: Profile | null
  initialSubscription?: any
  initialCategories?: any[]
}

export default function Header({ initialUser, initialSubscription, initialCategories = [] }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<Profile | null>(initialUser || null)
  const [subscription, setSubscription] = useState<any>(initialSubscription || null)
  const [categories, setCategories] = useState<any[]>(initialCategories)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    let mounted = true
    let authSubscription: { unsubscribe: () => void } | null = null
    let isUpdating = false
    let lastUserId: string | null = null

    // Verificar usuário autenticado imediatamente ao montar (para evitar flash)
    const checkInitialSession = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!mounted) return

        // Se temos initialUser do servidor, usar ele e assinatura
        if (initialUser && initialUser.id) {
          setUser(initialUser)
          
          // Se já temos initialSubscription, usar ela, senão carregar
          if (initialSubscription) {
            if (mounted) {
              setSubscription(initialSubscription)
            }
          } else {
            // Carregar assinatura imediatamente se não foi passada
            const { data: subscriptionData } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', initialUser.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            
            if (mounted) {
              setSubscription(subscriptionData)
            }
          }
        } else if (authUser) {
          // Se não temos initialUser mas temos usuário autenticado no cliente, buscar dados
          const [profileResult, subscriptionResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('*')
              .eq('id', authUser.id)
              .single(),
            supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', authUser.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          ])
          
          if (mounted) {
            setUser(profileResult.data)
            setSubscription(subscriptionResult.data)
          }
        } else if (!authUser && user) {
          // Se não há usuário autenticado mas temos usuário no estado, limpar
          if (mounted) {
            setUser(null)
            setSubscription(null)
          }
        }
      } catch (error) {
        console.error('Erro ao verificar sessão inicial:', error)
      }
    }

    checkInitialSession()

    // Sincroniza o estado do usuário se a sessão mudar no cliente
    const setupAuthListener = async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted || isUpdating) return
        
        // Ignorar eventos de token refresh
        if (event === 'TOKEN_REFRESHED') return
        // Ignorar signed_in inicial se já temos o usuário correto
        if (event === 'SIGNED_IN' && user?.id === session?.user?.id) return

        // Evitar atualizações duplicadas para o mesmo usuário
        if (session?.user?.id === lastUserId && user?.id === session.user.id) return

        isUpdating = true
        lastUserId = session?.user?.id || null

        try {
          if (session?.user) {
            // Só atualizar se o usuário mudou ou não temos dados ainda
            if (!user || user.id !== session.user.id) {
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
              
              if (mounted) {
                setUser(profileResult.data)
                setSubscription(subscriptionResult.data)
              }
            }
          } else {
            if (mounted && user) {
              setUser(null)
              setSubscription(null)
              lastUserId = null
            }
          }
        } catch (error) {
          console.error('Erro ao atualizar estado do usuário:', error)
        } finally {
          isUpdating = false
        }
      })
      
      authSubscription = subscription
    }

    setupAuthListener()

    return () => {
      mounted = false
      if (authSubscription) {
        authSubscription.unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recarregar assinatura quando o pathname mudar (especialmente após pagamento)
  useEffect(() => {
    const refreshSubscription = async () => {
      if (!user?.id) return

      try {
        // Verificar e atualizar status da assinatura primeiro
        const { isActive, subscription: activeSub } = await checkAndUpdateSubscriptionStatusClient(user.id)

        // Buscar assinatura atualizada
        const { data: subscriptionData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Usar a assinatura ativa encontrada pela verificação, ou a do banco
        const finalSubscription = activeSub || subscriptionData

        // Atualizar apenas se mudou
        if (finalSubscription?.id !== subscription?.id) {
          setSubscription(finalSubscription)
        }

        // Também atualizar o perfil para pegar is_premium atualizado
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileData) {
          setUser(profileData)
        }
      } catch (error) {
        console.error('Erro ao recarregar assinatura:', error)
      }
    }

    // Recarregar quando o pathname mudar para dashboard ou account
    if (pathname === '/dashboard' || pathname === '/account' || pathname.startsWith('/checkout')) {
      // Aguardar um pouco para dar tempo do backend processar o pagamento
      const timeout = setTimeout(() => {
        refreshSubscription()
      }, 1000)

      return () => clearTimeout(timeout)
    }
  }, [pathname, user?.id, subscription?.id, supabase])

  async function handleSignOut() {
    if (isLoggingOut) return
    
    setIsLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      toast.success('Logout realizado com sucesso')
      // Usar window.location para garantir limpeza completa do estado
      window.location.href = '/'
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error)
      toast.error('Erro ao fazer logout. Tente novamente.')
      setIsLoggingOut(false)
    }
  }

  const isActive = (path: string) => pathname === path

  // Buscar apenas categorias principais (sem parent_id)
  const mainCategories = categories.filter(c => !c.parent_id).sort((a, b) => a.order_index - b.order_index)
  
  // Encontrar categoria PSD para verificar subcategorias
  const psdCategory = mainCategories.find(c => 
    c.slug.toLowerCase() === 'psd' || c.name.toLowerCase() === 'psd'
  )
  
  // Subcategorias de PSD (incluindo Mockups)
  const psdSubItems = psdCategory 
    ? categories
        .filter(c => c.parent_id === psdCategory.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map(sub => ({
          id: `subcategory-${sub.id}`,
          name: sub.name,
          href: `/categories/${sub.slug}`
        }))
    : []
  
  // Encontrar subcategoria Mockups de PSD para adicionar como item direto no menu
  const mockupsSubcategory = categories.find(c => 
    (c.slug.toLowerCase() === 'mockups-psd' || c.name.toLowerCase() === 'mockups') 
    && c.parent_id === psdCategory?.id
  )
  
  // Construir menu com todas as categorias principais
  // Mapear slugs para rotas específicas quando existirem, senão usar /categories/{slug}
  const getCategoryHref = (slug: string) => {
    const routeMap: Record<string, string> = {
      'imagens': '/images',
      'fontes': '/fonts',
      'audios': '/audios',
      'png': '/png'
    }
    return routeMap[slug.toLowerCase()] || `/categories/${slug}`
  }

  const menuItems = [
    ...mainCategories
      .filter(category => category.slug.toLowerCase() !== 'mockups') // Excluir categoria Mockups principal
      .map(category => {
        // Apenas PSD tem dropdown com subcategorias
        const isPSD = category.slug.toLowerCase() === 'psd'
        const hasDropdown = isPSD && psdSubItems.length > 0
        
        return {
          id: `category-${category.id}`,
          name: category.name,
          href: getCategoryHref(category.slug),
          hasDropdown: hasDropdown,
          subItems: isPSD ? psdSubItems : []
        }
      }),
    // Adicionar Mockups como item direto (subcategoria de PSD)
    ...(mockupsSubcategory ? [{
      id: `mockups-subcategory-${mockupsSubcategory.id}`,
      name: 'Mockups',
      href: `/categories/${mockupsSubcategory.slug}`,
      hasDropdown: false,
      subItems: []
    }] : []),
    { id: 'png', name: 'PNG', href: '/png' },
    { id: 'collections', name: 'Coleções', href: '/collections' }
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white">
      {/* Top Row: Logo & User Actions */}
      <div className="border-b border-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-2">
            {/* Logo */}
            <Link href="/" className="flex items-center flex-shrink-0 min-w-0">
              <Logo variant="dark" />
            </Link>

            {/* Top Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2 md:gap-6 flex-shrink-0 min-w-0">
              <button className="hidden sm:flex text-gray-500 hover:text-gray-900 transition-colors">
                <Moon className="h-5 w-5" />
              </button>

              {user?.is_premium && subscription ? (
                <Link 
                  href="/premium" 
                  className="hidden md:flex items-center space-x-2 text-base font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Crown className="h-4 w-4" />
                  <span>Premium {subscription.tier.toUpperCase()}</span>
                </Link>
              ) : (
              <Link 
                href="/premium" 
                className="hidden md:flex text-base font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Assine o premium
              </Link>
              )}

              <div className="flex items-center gap-2 md:gap-3">
                {user ? (
                  <>
                    <Link
                      href="/favorites"
                      className="p-2 text-gray-500 hover:text-gray-900"
                    >
                      <Heart className="h-5 w-5" />
                    </Link>
                    {!user.is_creator && (
                      <Link href="/creator/apply">
                        <Button variant="primary" size="sm" className="hidden md:flex rounded-full px-4">
                          <Sparkles className="mr-2 h-4 w-4" />
                          Torne-se criador
                        </Button>
                      </Link>
                    )}
                    <Link href="/dashboard">
                      <Button variant="outline" size="sm" className="hidden sm:flex rounded-full px-5">
                        <User className="mr-2 h-4 w-4" />
                        Minha Conta
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleSignOut} 
                      disabled={isLoggingOut}
                      className="hidden sm:flex text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoggingOut ? 'Saindo...' : 'Sair'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/signup">
                      <Button variant="outline" size="sm" className="rounded-full px-3 sm:px-4 md:px-6 border-gray-200 text-gray-700 font-semibold text-xs sm:text-sm whitespace-nowrap">
                        Cadastre-se
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="secondary" size="sm" className="rounded-full px-3 sm:px-4 md:px-8 font-semibold text-xs sm:text-sm whitespace-nowrap">
                        <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 fill-current" />
                        Entrar
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-gray-600 flex-shrink-0 ml-2"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Navigation Menu */}
      <div className="hidden md:block bg-gray-50/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-12 items-center justify-between">
            <nav className="flex items-center space-x-6">
              {menuItems.map((item) => (
                <div key={item.id || item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center text-base font-medium transition-colors py-4 ${
                      isActive(item.href) ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.name}
                    {'hasDropdown' in item && item.hasDropdown && <ChevronDown className="ml-1 h-3 w-3 opacity-50 transition-transform group-hover:rotate-180" />}
                  </Link>

                  {'hasDropdown' in item && item.hasDropdown && (
                    <div className="absolute left-0 top-full hidden group-hover:block w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {'subItems' in item && item.subItems?.map((sub: any) => (
                        <Link
                          key={sub.id || sub.name}
                          href={sub.href}
                          className="block px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-secondary-600 transition-colors"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-4 px-4 space-y-4 max-h-[calc(100vh-64px)] overflow-y-auto">
          {user?.is_premium && subscription ? (
            <Link 
              href="/premium" 
              className="block text-center font-semibold text-primary-600 py-2 bg-primary-50 rounded-lg mb-4 flex items-center justify-center space-x-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <Crown className="h-4 w-4" />
              <span>Premium {subscription.tier.toUpperCase()}</span>
            </Link>
          ) : (
          <Link 
            href="/premium" 
            className="block text-center font-semibold text-orange-500 py-2 bg-orange-50 rounded-lg mb-4"
            onClick={() => setIsMenuOpen(false)}
          >
            Assine o premium
          </Link>
          )}
          
          {/* User actions mobile */}
          {user ? (
            <div className="space-y-2 pb-4 border-b border-gray-100">
              <Link
                href="/favorites"
                className="flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                <Heart className="h-5 w-5" />
                <span>Favoritos</span>
              </Link>
              {!user.is_creator && (
                <Link
                  href="/creator/apply"
                  className="flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Sparkles className="h-5 w-5" />
                  <span>Torne-se criador</span>
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                <User className="h-5 w-5" />
                <span>Minha Conta</span>
              </Link>
              <button
                onClick={() => {
                  handleSignOut()
                  setIsMenuOpen(false)
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50"
              >
                <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2 pb-4 border-b border-gray-100">
              <Link
                href="/signup"
                className="block text-center py-2 px-4 border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                onClick={() => setIsMenuOpen(false)}
              >
                Cadastre-se
              </Link>
              <Link
                href="/login"
                className="block text-center py-2 px-4 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600"
                onClick={() => setIsMenuOpen(false)}
              >
                Entrar
              </Link>
            </div>
          )}
          
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <div key={item.id || item.name}>
                <Link
                  href={item.href}
                  className={`block py-2 px-2 text-base font-semibold rounded-lg ${
                    isActive(item.href) 
                      ? 'text-primary-600 bg-primary-50' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
                {'hasDropdown' in item && item.hasDropdown && 'subItems' in item && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.subItems.map((sub: any) => (
                      <Link
                        key={sub.id || sub.name}
                        href={sub.href}
                        className={`block py-1.5 px-2 text-sm rounded-lg ${
                          isActive(sub.href)
                            ? 'text-primary-600 bg-primary-50'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

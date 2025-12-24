'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { User, Heart, Upload, Menu, X, ChevronDown, Moon, Crown } from 'lucide-react'
import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import toast from 'react-hot-toast'

interface HeaderProps {
  initialUser?: Profile | null
  initialCategories?: any[]
}

export default function Header({ initialUser, initialSubscription, initialCategories = [] }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<Profile | null>(initialUser || null)
  const [subscription, setSubscription] = useState<any>(initialSubscription || null)
  const [categories, setCategories] = useState<any[]>(initialCategories)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    let mounted = true
    let authSubscription: { unsubscribe: () => void } | null = null
    let isUpdating = false
    let lastUserId: string | null = null

    // Verificar sessão imediatamente ao montar (para evitar flash)
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
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
        } else if (session?.user) {
          // Se não temos initialUser mas temos sessão no cliente, buscar dados
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
        } else if (!session && user) {
          // Se não há sessão mas temos usuário, limpar
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

  const menuItems = [
    { id: 'home', name: 'Home', href: '/' },
    { id: 'images', name: 'Imagens', href: '/images' },
    { id: 'collections', name: 'Coleções', href: '/collections' },
    ...categories
      .filter(c => !c.parent_id)
      .map(parent => ({
        id: `category-${parent.id}`,
        name: parent.name,
        href: `/categories/${parent.slug}`,
        hasDropdown: categories.some(c => c.parent_id === parent.id),
        subItems: categories
          .filter(c => c.parent_id === parent.id)
          .map(sub => ({
            id: `subcategory-${sub.id}`,
            name: sub.name,
            href: `/categories/${sub.slug}`
          }))
      })),
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white">
      {/* Top Row: Logo & User Actions */}
      <div className="border-b border-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3">
              <Logo variant="dark" />
            </Link>

            {/* Top Right Actions */}
            <div className="flex items-center space-x-6">
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

              <div className="flex items-center space-x-3">
                {user ? (
                  <>
                    <Link
                      href="/favorites"
                      className="p-2 text-gray-500 hover:text-gray-900"
                    >
                      <Heart className="h-5 w-5" />
                    </Link>
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
                      className="text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoggingOut ? 'Saindo...' : 'Sair'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/signup">
                      <Button variant="outline" size="sm" className="rounded-full px-6 border-gray-200 text-gray-700 font-semibold">
                        Cadastre-se
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="secondary" size="sm" className="rounded-full px-8 font-semibold">
                        <User className="mr-2 h-4 w-4 fill-current" />
                        Entrar
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-gray-600"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
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

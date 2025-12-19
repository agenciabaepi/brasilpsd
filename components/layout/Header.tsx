'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { User, Heart, Upload, Menu, X, ChevronDown, Moon, Crown } from 'lucide-react'
import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface HeaderProps {
  initialUser?: Profile | null
  initialCategories?: any[]
}

export default function Header({ initialUser, initialCategories = [] }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<Profile | null>(initialUser || null)
  const [categories, setCategories] = useState<any[]>(initialCategories)
  const pathname = usePathname()
  const supabase = createSupabaseClient()

  useEffect(() => {
    // Sincroniza o estado do usuário se a sessão mudar no cliente
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setUser(profile)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  const isActive = (path: string) => pathname === path

  const menuItems = [
    { name: 'Home', href: '/' },
    ...categories
      .filter(c => !c.parent_id)
      .map(parent => ({
        name: parent.name,
        href: `/categories/${parent.slug}`,
        hasDropdown: categories.some(c => c.parent_id === parent.id),
        subItems: categories
          .filter(c => c.parent_id === parent.id)
          .map(sub => ({
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

              <Link 
                href="/premium" 
                className="hidden md:flex text-base font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Assine o premium
              </Link>

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
                    <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-gray-500">
                      Sair
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
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center text-base font-medium transition-colors py-4 ${
                      isActive(item.href) ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.name}
                    {item.hasDropdown && <ChevronDown className="ml-1 h-3 w-3 opacity-50 transition-transform group-hover:rotate-180" />}
                  </Link>

                  {item.hasDropdown && (
                    <div className="absolute left-0 top-full hidden group-hover:block w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {item.subItems?.map((sub) => (
                        <Link
                          key={sub.name}
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
        <div className="md:hidden border-t border-gray-100 bg-white py-4 px-4 space-y-4">
          <Link href="/premium" className="block text-center font-semibold text-orange-500 py-2 bg-orange-50 rounded-lg">
            Assine o premium
          </Link>
          <nav className="grid grid-cols-2 gap-y-4">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-base font-semibold text-gray-600"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

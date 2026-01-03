'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { 
  LayoutDashboard, 
  Files, 
  Users, 
  Tag, 
  Settings, 
  LogOut, 
  ExternalLink,
  CheckSquare,
  Crown,
  CreditCard,
  Repeat,
  Menu,
  X,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const menuItems = [
  { name: 'Painel', href: '/admin', icon: LayoutDashboard },
  { name: 'Aprovações', href: '/admin/approvals', icon: CheckSquare },
  { name: 'Solicitações Criadores', href: '/admin/creator-applications', icon: Users },
  { name: 'Recursos', href: '/admin/resources', icon: Files },
  { name: 'Usuários', href: '/admin/users', icon: Users },
  { name: 'Assinaturas', href: '/admin/subscriptions', icon: Repeat },
  { name: 'Categorias', href: '/admin/categories', icon: Tag },
  { name: 'Financeiro', href: '/admin/finance', icon: CreditCard },
  { name: 'Comissões', href: '/admin/commissions', icon: DollarSign },
  { name: 'Configurações', href: '/admin/settings', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Fechar menu ao mudar de rota no mobile
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Prevenir scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  async function handleSignOut() {
    if (isLoggingOut) return
    
    setIsLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      toast.success('Logout realizado com sucesso')
      // Usar window.location para garantir limpeza completa do estado
      window.location.href = '/'
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error)
      toast.error('Erro ao fazer logout. Tente novamente.')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6 text-gray-700" />
        ) : (
          <Menu className="h-6 w-6 text-gray-700" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen w-64 border-r border-gray-200 bg-white p-4 flex flex-col z-30 transition-transform duration-300",
        "lg:translate-x-0 lg:z-20",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="mb-8 px-4 py-2">
          <Link href="/" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
            <Logo variant="dark" className="h-6" width={100} height={32} />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all",
                  isActive 
                    ? "bg-primary-50 text-primary-600" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary-600" : "text-gray-400")} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-gray-100 pt-4 space-y-1">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
          >
            <ExternalLink className="h-5 w-5 text-gray-400" />
            <span>Voltar ao Site</span>
          </Link>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="h-5 w-5 text-red-400" />
            <span>{isLoggingOut ? 'Saindo...' : 'Sair do Painel'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { 
  LayoutDashboard, 
  UploadCloud, 
  Files, 
  DollarSign, 
  User, 
  ExternalLink, 
  LogOut,
  ChevronRight,
  FolderOpen,
  Type,
  Music,
  Video,
  Menu,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const menuItems = [
  { name: 'Painel', href: '/creator', icon: LayoutDashboard },
  { name: 'Meus Arquivos', href: '/creator/resources', icon: Files },
  { name: 'Fazer Upload', href: '/creator/upload', icon: UploadCloud },
  { name: 'Upload de Fonte', href: '/creator/upload/font', icon: Type },
  { name: 'Upload de Áudio', href: '/creator/upload/audio', icon: Music },
  { name: 'Upload de Motion', href: '/creator/upload/motion', icon: Video },
  { name: 'Coleções', href: '/creator/collections', icon: FolderOpen },
  { name: 'Minhas Comissões', href: '/creator/earnings', icon: DollarSign },
  { name: 'Perfil Criador', href: '/creator/profile', icon: User },
]

export default function CreatorSidebar() {
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
        "fixed left-0 top-0 h-screen w-64 border-r border-gray-100 bg-white p-4 flex flex-col z-30 transition-transform duration-300",
        "lg:translate-x-0 lg:z-20",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="mb-10 px-4 py-2">
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
                  "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all group",
                  isActive 
                    ? "bg-primary-50 text-primary-600" 
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                )}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary-600" : "text-gray-300 group-hover:text-gray-400")} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4" />}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-gray-50 pt-6 space-y-1 pb-4">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
          >
            <ExternalLink className="h-5 w-5" />
            <span>Ver Site Público</span>
          </Link>
          <button 
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="h-5 w-5" />
            <span>{isLoggingOut ? 'Saindo...' : 'Sair da Conta'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

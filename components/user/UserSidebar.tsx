'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { 
  LayoutDashboard, 
  User, 
  CreditCard,
  Download,
  Heart,
  Users,
  Gift,
  MessageCircle,
  Mail,
  ExternalLink,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const menuItems = [
  { name: 'Minha conta', href: '/dashboard', icon: User },
  { name: 'Cobrança', href: '/billing', icon: CreditCard },
  { name: 'Downloads', href: '/downloads', icon: Download },
  { name: 'Curtidas', href: '/favorites', icon: Heart },
  { name: 'Salvos', href: '/saved', icon: Heart },
  { name: 'Seguindo', href: '/following', icon: Users },
  { name: 'Afiliado', href: '/affiliate', icon: Gift },
]

export default function UserSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gray-200 bg-white p-4 flex flex-col z-20">
      <div className="mb-8 px-4 py-2">
        <Link href="/" className="flex items-center">
          <Logo variant="dark" className="h-6" width={100} height={32} />
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
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
        {/* Suporte */}
        <div className="px-4 py-2 space-y-2">
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
          >
            <MessageCircle className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold">Suporte por WhatsApp</p>
              <p className="text-[10px] text-gray-400">Dúvidas e perguntas</p>
            </div>
          </a>
          <a
            href="mailto:suporte@brasilpsd.com"
            className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
          >
            <Mail className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold">Formulário de e-mail</p>
              <p className="text-[10px] text-gray-400">Resolver problemas</p>
            </div>
          </a>
        </div>

        <Link
          href="/"
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
          <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
        </button>
      </div>
    </aside>
  )
}


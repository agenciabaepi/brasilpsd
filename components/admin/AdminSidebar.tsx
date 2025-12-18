'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Repeat
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const menuItems = [
  { name: 'Painel', href: '/admin', icon: LayoutDashboard },
  { name: 'Aprovações', href: '/admin/approvals', icon: CheckSquare },
  { name: 'Recursos', href: '/admin/resources', icon: Files },
  { name: 'Usuários', href: '/admin/users', icon: Users },
  { name: 'Assinaturas', href: '/admin/subscriptions', icon: Repeat },
  { name: 'Categorias', href: '/admin/categories', icon: Tag },
  { name: 'Financeiro', href: '/admin/finance', icon: CreditCard },
  { name: 'Configurações', href: '/admin/settings', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gray-200 bg-white p-4 flex flex-col z-20">
      <div className="mb-8 px-4 py-2">
        <Link href="/" className="flex items-center space-x-2">
          <div className="h-9 w-9 rounded-xl bg-primary-500 flex items-center justify-center text-white">
            <Crown className="h-5 w-5 fill-current" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-gray-900">
            Brasil<span className="text-primary-500">Admin</span>
          </span>
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
        <Link
          href="/"
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
        >
          <ExternalLink className="h-5 w-5 text-gray-400" />
          <span>Voltar ao Site</span>
        </Link>
        <button
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut className="h-5 w-5 text-red-400" />
          <span>Sair do Painel</span>
        </button>
      </div>
    </aside>
  )
}

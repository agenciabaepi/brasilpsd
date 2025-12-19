'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { 
  LayoutDashboard, 
  UploadCloud, 
  Files, 
  DollarSign, 
  User, 
  ExternalLink, 
  LogOut,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const menuItems = [
  { name: 'Painel', href: '/creator', icon: LayoutDashboard },
  { name: 'Meus Arquivos', href: '/creator/resources', icon: Files },
  { name: 'Fazer Upload', href: '/creator/upload', icon: UploadCloud },
  { name: 'Minhas Comissões', href: '/creator/earnings', icon: DollarSign },
  { name: 'Perfil Criador', href: '/creator/profile', icon: User },
]

export default function CreatorSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gray-100 bg-white p-4 flex flex-col z-20">
      <div className="mb-10 px-4 py-2">
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
          className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
        >
          <ExternalLink className="h-5 w-5" />
          <span>Ver Site Público</span>
        </Link>
        <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <LogOut className="h-5 w-5" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </aside>
  )
}

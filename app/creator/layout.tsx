import CreatorSidebar from '@/components/creator/CreatorSidebar'
import { User } from 'lucide-react'

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex font-sans">
      <CreatorSidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-100 sticky top-0 z-10 flex items-center px-8 justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Painel do Criador
            </h2>
          </div>
          <div className="flex items-center space-x-6">
            <div className="h-8 w-[1px] bg-gray-100" />
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-gray-900 leading-none">Status da Conta</p>
                <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-tighter mt-1">Nível Bronze</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                <User className="h-5 w-5 text-primary-500" />
              </div>
            </div>
          </div>
        </header>
        <main className="p-10 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

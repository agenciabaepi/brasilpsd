import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      <AdminSidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center px-8 justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
              Gestão BrasilPSD
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-semibold text-white bg-primary-500 px-3 py-1 rounded-full uppercase tracking-tighter">
              Acesso Administrador
            </span>
          </div>
        </header>
        <main className="p-10 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

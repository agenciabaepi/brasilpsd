import UserSidebar from '@/components/user/UserSidebar'

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      <UserSidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <main className="p-10 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}


'use client'

import { Plus } from 'lucide-react'
import Image from 'next/image'

interface UserAvatar {
  avatar_url: string | null
  full_name: string | null
}

interface UserStatsBarProps {
  userAvatars?: UserAvatar[]
}

// Placeholder avatares caso não tenhamos usuários com avatares
const avatarPlaceholders = [
  'https://ui-avatars.com/api/?name=Maria+Silva&background=e8f5e9&color=2e7d32&size=128',
  'https://ui-avatars.com/api/?name=Ana+Costa&background=fff3e0&color=ef6c00&size=128',
  'https://ui-avatars.com/api/?name=Carlos+Santos&background=e3f2fd&color=1976d2&size=128',
]

export default function UserStatsBar({ userAvatars = [] }: UserStatsBarProps) {
  // Usar avatares reais se disponíveis, caso contrário usar placeholders
  const validAvatars = (userAvatars || [])
    .filter(u => u && u.avatar_url && typeof u.avatar_url === 'string' && u.avatar_url.trim() !== '')
    .slice(0, 3)
    .map(u => u.avatar_url as string)

  const avatarsToShow = validAvatars.length >= 3 ? validAvatars : avatarPlaceholders

  return (
    <div className="flex items-center justify-center mb-6">
      <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-gray-100 rounded-full">
        {/* Avatares sobrepostos */}
        <div className="flex items-center -space-x-3">
          {avatarsToShow.map((avatar, index) => (
            <div
              key={`avatar-${index}`}
              className="relative w-9 h-9 rounded-full border-2 border-white overflow-hidden bg-gray-200 flex-shrink-0"
            >
              <Image
                src={avatar}
                alt={`Usuário ${index + 1}`}
                fill
                className="object-cover"
                sizes="36px"
                unoptimized={avatar.includes('ui-avatars.com')}
              />
            </div>
          ))}
        </div>
        
        {/* Ícone de plus em círculo verde claro */}
        <div className="w-9 h-9 rounded-full bg-primary-400 flex items-center justify-center flex-shrink-0">
          <Plus className="h-4 w-4 text-white" strokeWidth={3} />
        </div>
        
        {/* Texto */}
        <span className="text-sm font-medium text-gray-900 whitespace-nowrap ml-1">
          +100 pessoas já usam
        </span>
      </div>
    </div>
  )
}


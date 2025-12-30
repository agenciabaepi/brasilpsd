'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface GridALiciousProps {
  children: ReactNode[]
  gap?: number
  className?: string
  imageSize?: 'small' | 'large'
  isSidebarOpen?: boolean
}

export default function GridALicious({
  children,
  gap = 8,
  className,
  imageSize = 'small',
  isSidebarOpen = false
}: GridALiciousProps) {
  // Calcular número de colunas baseado no tamanho
  const getGridCols = () => {
    if (imageSize === 'large') {
      return 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    }
    return 'lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-1',
        getGridCols(),
        className
      )}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  )
}

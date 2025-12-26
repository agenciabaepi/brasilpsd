import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface LogoProps {
  variant?: 'light' | 'dark' | 'auto'
  className?: string
  width?: number
  height?: number
}

export default function Logo({ variant = 'auto', className, width = 120, height = 40 }: LogoProps) {
  // Se variant for 'auto', usa preto por padrão (pode ser melhorado para detectar background)
  const logoSrc = variant === 'dark' || (variant === 'auto') 
    ? '/images/logopreto.png' 
    : '/images/logobranco.png'

  return (
    <div className={cn("relative flex items-center flex-shrink-0", className)} style={{ height: '32px' }}>
      <Image
        src={logoSrc}
        alt="BrasilPSD"
        width={width}
        height={height}
        className="h-8 w-auto object-contain"
        style={{ maxHeight: '32px', maxWidth: 'none' }}
        priority
      />
    </div>
  )
}







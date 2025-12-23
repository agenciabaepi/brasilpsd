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
    <Image
      src={logoSrc}
      alt="BrasilPSD"
      width={width}
      height={height}
      className={cn("h-8 w-auto", className)}
      priority
    />
  )
}






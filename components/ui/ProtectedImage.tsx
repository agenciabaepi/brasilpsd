'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { getS3Url } from '@/lib/aws/s3'

interface ProtectedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  sizes?: string
  priority?: boolean
  loading?: 'lazy' | 'eager'
  quality?: number
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
}

/**
 * Componente de imagem protegida com múltiplas camadas de segurança:
 * - Bloqueia right-click, drag, seleção
 * - Overlay invisível para bloquear interações
 * - Desabilita seleção de texto/imagem via CSS
 * - Usa apenas preview_url/thumbnail_url (nunca file_url)
 */
export default function ProtectedImage({
  src,
  alt,
  width,
  height,
  fill,
  className = '',
  sizes,
  priority = false,
  loading = 'lazy',
  quality = 75, // Qualidade reduzida por padrão
  objectFit = 'contain'
}: ProtectedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Bloquear todas as formas de acesso à imagem
    const preventDefault = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }

    // Bloquear eventos de mouse
    const events = [
      'contextmenu', // Right-click
      'dragstart', // Drag
      'selectstart', // Seleção
      'mousedown', // Clique
      'copy', // Copiar
      'cut', // Cortar
    ]

    events.forEach(event => {
      container.addEventListener(event, preventDefault, { passive: false })
    })

    // Bloquear atalhos de teclado
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloquear F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'S' || e.key === 'P'))
      ) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Bloquear DevTools (tentativa básica)
    const handleDevTools = () => {
      // TEMPORARIAMENTE DESABILITADO PARA DEBUG
      return
      /*
      const widthThreshold = window.outerWidth - window.innerWidth > 160
      const heightThreshold = window.outerHeight - window.innerHeight > 160
      
      if (widthThreshold || heightThreshold) {
        // DevTools pode estar aberto, mas não podemos fazer muito
        console.clear()
      }
      */
    }

    const interval = setInterval(handleDevTools, 1000)

    return () => {
      events.forEach(event => {
        container.removeEventListener(event, preventDefault)
      })
      window.removeEventListener('keydown', handleKeyDown)
      clearInterval(interval)
    }
  }, [])

  // Usar API route protegida em vez de URL direta do S3
  // Isso garante que apenas previews/thumbnails sejam acessíveis e com qualidade reduzida
  const getProtectedImageUrl = () => {
    if (src.startsWith('http')) {
      // Se já é uma URL completa, verificar se é do S3 e converter para API route
      if (src.includes('s3.') || src.includes('amazonaws.com') || src.includes('cloudfront.net')) {
        // Extrair a key do S3 da URL
        const urlObj = new URL(src)
        const s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname
        
        // Usar API route protegida
        return `/api/image/${s3Key}?q=${quality}&w=${width || ''}`
      }
      // Se for uma URL externa (não S3), usar diretamente
      return src
    }
    // Se for apenas a key do S3, usar API route protegida
    return `/api/image/${src}?q=${quality}&w=${width || ''}`
  }

  const imageUrl = getProtectedImageUrl()

  return (
    <div
      ref={containerRef}
      className={`relative ${fill ? 'w-full h-full' : ''} select-none`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        pointerEvents: 'auto',
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }}
      onDragStart={(e) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }}
      onSelectStart={(e) => {
        e.preventDefault()
        return false
      }}
      onMouseDown={(e) => {
        // Bloquear clique direito e meio
        if (e.button === 2 || e.button === 1) {
          e.preventDefault()
          e.stopPropagation()
          return false
        }
      }}
    >
      {/* Overlay invisível para bloquear interações */}
      <div
        className="absolute inset-0 z-10"
        style={{
          pointerEvents: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          return false
        }}
        onDragStart={(e) => {
          e.preventDefault()
          e.stopPropagation()
          return false
        }}
        onClick={(e) => {
          // Permitir apenas clique esquerdo normal (para navegação)
          if (e.button !== 0) {
            e.preventDefault()
            e.stopPropagation()
            return false
          }
        }}
      />
      
      {/* Imagem com qualidade reduzida via API route protegida */}
      {/* Usar unoptimized quando for nossa API route para evitar dupla otimização */}
      {fill ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className={`${className} pointer-events-none`}
          sizes={sizes}
          {...(priority ? { priority: true } : { loading })}
          unoptimized={imageUrl.startsWith('/api/image')}
          style={{
            objectFit,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            return false
          }}
          onDragStart={(e) => {
            e.preventDefault()
            e.stopPropagation()
            return false
          }}
        />
      ) : (
        <Image
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          className={`${className} pointer-events-none`}
          sizes={sizes}
          {...(priority ? { priority: true } : { loading })}
          unoptimized={imageUrl.startsWith('/api/image')}
          style={{
            objectFit,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            return false
          }}
          onDragStart={(e) => {
            e.preventDefault()
            e.stopPropagation()
            return false
          }}
        />
      )}
    </div>
  )
}


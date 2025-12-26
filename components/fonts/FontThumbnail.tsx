'use client'

import { useState, useEffect } from 'react'
import { getS3Url } from '@/lib/aws/s3'
import { Type } from 'lucide-react'

interface FontThumbnailProps {
  resource: {
    id: string
    file_url: string
    file_format?: string | null
    title: string
  }
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export default function FontThumbnail({ resource, size = 'medium', className = '' }: FontThumbnailProps) {
  const [fontLoaded, setFontLoaded] = useState(false)
  const [fontName, setFontName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFont() {
      if (!resource.file_url) {
        setLoading(false)
        return
      }

      try {
        const fontUrl = getS3Url(resource.file_url)
        const fontId = `font-thumb-${resource.id.replace(/-/g, '')}`
        
        // Verificar se o estilo já existe
        const existingStyle = document.getElementById(`font-style-thumb-${resource.id}`)
        if (existingStyle) {
          setFontName(fontId)
          setFontLoaded(true)
          setLoading(false)
          return
        }
        
        // Criar @font-face dinamicamente
        const style = document.createElement('style')
        style.id = `font-style-thumb-${resource.id}`
        
        // Determinar formato da fonte
        const fileFormat = resource.file_format?.toLowerCase() || 'ttf'
        let fontFormat = 'truetype'
        if (fileFormat === 'otf') fontFormat = 'opentype'
        else if (fileFormat === 'woff') fontFormat = 'woff'
        else if (fileFormat === 'woff2') fontFormat = 'woff2'
        
        style.textContent = `
          @font-face {
            font-family: '${fontId}';
            src: url('${fontUrl}') format('${fontFormat}');
            font-display: swap;
          }
        `
        document.head.appendChild(style)
        
        // Aguardar carregamento da fonte
        const font = new FontFace(fontId, `url(${fontUrl})`)
        await font.load()
        document.fonts.add(font)
        
        setFontName(fontId)
        setFontLoaded(true)
      } catch (error) {
        console.error('Error loading font for thumbnail:', error)
        setFontLoaded(false)
      } finally {
        setLoading(false)
      }
    }
    loadFont()
  }, [resource.id, resource.file_url, resource.file_format])

  const fontFamily = fontLoaded && fontName ? `'${fontName}', sans-serif` : 'sans-serif'
  
  // Tamanhos baseados no prop size
  const sizeClasses = {
    small: {
      container: 'h-32',
      title: 'text-lg',
      preview: 'text-2xl',
      alphabet: 'text-sm'
    },
    medium: {
      container: 'h-40',
      title: 'text-xl',
      preview: 'text-3xl',
      alphabet: 'text-base'
    },
    large: {
      container: 'h-48',
      title: 'text-2xl',
      preview: 'text-4xl',
      alphabet: 'text-lg'
    }
  }

  const sizes = sizeClasses[size]

  if (loading) {
    return (
      <div className={`${sizes.container} bg-gray-50 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto mb-2"></div>
          <p className="text-xs text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  // Preview compacto: título + alfabeto maiúsculo
  const previewText = resource.title.length > 20 ? resource.title.substring(0, 20) + '...' : resource.title
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  return (
    <div className={`${sizes.container} bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-center items-center ${className}`}>
      <div className="w-full text-center space-y-2">
        {/* Título da fonte */}
        <div 
          style={{ fontFamily }}
          className={`${sizes.title} font-bold text-gray-900 truncate w-full`}
        >
          {previewText}
        </div>
        
        {/* Alfabeto compacto */}
        <div 
          style={{ fontFamily }}
          className={`${sizes.alphabet} font-normal text-gray-700 leading-tight tracking-wide`}
        >
          {alphabet.split('').slice(0, 13).join('')}
          <span className="text-gray-400">...</span>
        </div>
      </div>
    </div>
  )
}


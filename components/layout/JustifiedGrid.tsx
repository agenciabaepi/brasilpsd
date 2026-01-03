'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import justifiedLayout from 'justified-layout'
import Link from 'next/link'
import NextImage from 'next/image'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import { Crown } from 'lucide-react'
import { isSystemProfile } from '@/lib/utils/system'

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']
const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']

const isImagePath = (path: string) => {
  const lower = path.toLowerCase()
  return imageExtensions.some(ext => lower.endsWith(ext))
}

const isVideoPath = (path: string) => {
  const lower = path.toLowerCase()
  return videoExtensions.some(ext => lower.endsWith(ext))
}

interface JustifiedGridProps {
  resources: Resource[]
  rowHeight?: number
  margin?: number
}

/**
 * Layout justificado sem distorção (mantém proporção original).
 * Inspirado no grid Laravel (flex-images) com rowHeight 320.
 */
export default function JustifiedGrid({
  resources,
  rowHeight = 240,
  margin = 4,
}: JustifiedGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // Cache de dimensões medidas no client quando width/height não vierem do backend
  const [measuredDims, setMeasuredDims] = useState<Record<string, { w: number; h: number }>>({})

  // Resolver URL e tipo (image | video)
  // Para PNGs, sempre usar file_url (original) para preservar transparência
  // Para outros formatos, usar preview -> thumbnail -> file_url
  const resolveSrc = (resource: Resource): { src: string; kind: 'image' | 'video' } | null => {
    const isPng = resource.file_format?.toLowerCase() === 'png' || resource.resource_type === 'png'
    
    // Para PNGs, sempre usar o arquivo original
    let candidate: string | null = null
    if (isPng && resource.file_url) {
      candidate = resource.file_url
    } else {
      // Para outros formatos, usar preview -> thumbnail -> file_url
      candidate = resource.preview_url || resource.thumbnail_url || resource.file_url
    }
    
    if (!candidate) return null

    const absolute = candidate.startsWith('http')
    const isImage = isImagePath(candidate)
    const isVideo = isVideoPath(candidate) || resource.resource_type === 'video'

    if (isImage) {
      const src = absolute ? candidate : `/api/image/${candidate}?q=${isPng ? 100 : 65}` // Máxima qualidade para PNGs
      return { src, kind: 'image' }
    }

    // Vídeo: usar proxy para obter signed URL (bucket privado)
    const src = `/api/video/proxy?fileUrl=${encodeURIComponent(candidate)}`
    return { src, kind: 'video' }
  }

  // Montar items já com dimensões resolvidas; descartar sem dimensões e sem src
  const items = useMemo(() => {
    return resources
      .map((r) => {
        const resolved = resolveSrc(r)
        if (!resolved) return null
        const measured = r.id ? measuredDims[r.id] : undefined
        const width = measured?.w || r.width || 320
        const height = measured?.h || r.height || 240
        return { resource: r, width, height, ...resolved }
      })
      .filter(Boolean) as Array<{ resource: Resource; src: string; width: number; height: number; kind: 'image' | 'video' }>
  }, [resources, measuredDims])

  // Observar resize para recalcular layout
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (width !== containerWidth) {
          setContainerWidth(width)
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [containerWidth])

  // Medir dimensões reais no client quando não existirem no recurso (apenas imagens)
  useEffect(() => {
    resources.forEach((resource) => {
      if (!resource?.id) return
      // Já temos dimensões (do backend ou medidas)
      if ((resource.width && resource.height) || measuredDims[resource.id]) return

      const resolved = resolveSrc(resource)
      if (!resolved || resolved.kind !== 'image') return
      const src = resolved.src

      // Usar document.createElement para evitar conflito com Image do Next.js
      const img = document.createElement('img')
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return
        setMeasuredDims((prev) => {
          if (prev[resource.id]) return prev
          return { ...prev, [resource.id]: { w: img.naturalWidth, h: img.naturalHeight } }
        })
      }
      img.src = src
    })
  }, [resources, measuredDims])

  // Calcular boxes usando justified-layout
  const { boxes, containerHeight } = useMemo(() => {
    if (!containerWidth) return { boxes: [], containerHeight: 0 }
    const aspectRatios = items.map((item) => item.width / item.height)

    const layout = justifiedLayout(aspectRatios, {
      containerWidth: Math.max(containerWidth, 100),
      targetRowHeight: rowHeight,
      boxSpacing: margin,
    })

    return {
      boxes: layout.boxes || [],
      containerHeight: layout.containerHeight || 0,
    }
  }, [items, containerWidth, rowHeight, margin])

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: containerHeight }}
    >
      {boxes.map((box, index) => {
        const item = items[index]
        if (!item) return null
        const { resource, src, kind } = item
        const isOfficial = resource.is_official || isSystemProfile(resource.creator_id)
        const authorName = isOfficial ? (resource.creator?.full_name || 'BrasilPSD') : (resource.creator?.full_name || 'BrasilPSD')
        
        // Verificar se é PNG pelo formato, tipo ou extensão do arquivo
        const isPNG = 
          resource.file_format?.toLowerCase() === 'png' ||
          resource.resource_type === 'png' ||
          resource.file_url?.toLowerCase().endsWith('.png') ||
          resource.thumbnail_url?.toLowerCase().endsWith('.png') ||
          resource.preview_url?.toLowerCase().endsWith('.png')

        return (
          <Link
            key={resource.id}
            href={`/resources/${resource.id}`}
            className={`absolute block overflow-hidden rounded-lg group ${
              isPNG ? 'bg-checkerboard' : 'bg-gray-100'
            }`}
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
          >
            {kind === 'image' ? (
              <img
                src={src}
                alt={resource.title || ''}
                loading="lazy"
                className="block"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: 'transparent',
                }}
              />
            ) : (
              <video
                src={src}
                muted
                playsInline
                autoPlay
                loop
                preload="metadata"
                controls={false}
                className="block"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: 'transparent',
                }}
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
            
            {/* Premium Badge - Coroa no canto superior esquerdo */}
            {resource.is_premium && (
              <div className="absolute top-2 left-2 z-10">
                <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg">
                  <Crown className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            )}
            
            {/* Exclusivo Badge - Selo no canto superior direito */}
            {resource.is_official && (
              <div className="absolute top-2 right-2 z-10">
                <div className="bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                  <NextImage src="/images/verificado.svg" alt="Oficial" width={12} height={12} className="w-3 h-3" />
                </div>
              </div>
            )}
            
            {/* Overlay com título e criador (só aparece no hover) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white drop-shadow-lg truncate max-w-full tracking-tight">
                  {resource.title}
                </span>
                <span className="text-[10px] font-semibold text-gray-200 drop-shadow-lg flex items-center gap-1.5 tracking-tight mt-0.5">
                  {authorName}
                  {isOfficial && (
                    <NextImage src="/images/verificado.svg" alt="Verificado" width={10} height={10} className="w-2.5 h-2.5" />
                  )}
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import justifiedLayout from 'justified-layout'
import Link from 'next/link'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'

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

  // Resolver URL e tipo (image | video) usando preview -> thumbnail -> file_url
  const resolveSrc = (resource: Resource): { src: string; kind: 'image' | 'video' } | null => {
    const candidate = resource.preview_url || resource.thumbnail_url || resource.file_url
    if (!candidate) return null

    const absolute = candidate.startsWith('http')
    const isImage = isImagePath(candidate)
    const isVideo = isVideoPath(candidate) || resource.resource_type === 'video'

    if (isImage) {
      const src = absolute ? candidate : `/api/image/${candidate}?q=75`
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

      const img = new Image()
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
        return (
          <Link
            key={resource.id}
            href={`/resources/${resource.id}`}
            className="absolute block overflow-hidden rounded-lg bg-gray-100"
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
          </Link>
        )
      })}
    </div>
  )
}

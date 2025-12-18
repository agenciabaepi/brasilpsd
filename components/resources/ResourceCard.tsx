import Link from 'next/link'
import Image from 'next/image'
import { Heart, Sparkles } from 'lucide-react'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'

interface ResourceCardProps {
  resource: Resource
  onFavorite?: (resourceId: string) => void
  isFavorited?: boolean
}

export default function ResourceCard({ resource, onFavorite, isFavorited }: ResourceCardProps) {
  const authorName = resource.is_official ? 'BrasilPSD' : (resource.creator?.full_name || 'BrasilPSD');

  return (
    <Link href={`/resources/${resource.id}`} className="break-inside-avoid mb-6 block group">
      <div className="relative overflow-hidden rounded-2xl bg-gray-100 transition-all border border-gray-50 hover:border-primary-100 shadow-sm hover:shadow-md transition-all duration-300">
        {/* Image Container */}
        <div className="relative w-full overflow-hidden flex items-center justify-center min-h-[150px]">
          {resource.thumbnail_url ? (
            <Image
              src={getS3Url(resource.thumbnail_url)}
              alt={resource.title}
              width={500}
              height={500}
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={false}
            />
          ) : (
            <div className="aspect-square w-full flex items-center justify-center bg-gray-50 text-gray-400 text-[10px] font-bold tracking-widest uppercase">
              Sem prévia
            </div>
          )}
          
          {/* Status Badge (Top Corners like Designi) */}
          <div className="absolute top-2 left-2 z-10">
            {resource.is_premium && (
              <div className="bg-primary-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                Exclusivo
              </div>
            )}
            {!resource.is_premium && (
              <div className="bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                Grátis
              </div>
            )}
          </div>

          <div className="absolute top-2 right-2 z-10 flex gap-1">
            {resource.is_official && (
              <div className="bg-gray-900/80 backdrop-blur-sm p-1 rounded-md shadow-sm">
                <Image src="/images/verificado.svg" alt="Oficial" width={12} height={12} className="w-3 h-3" />
              </div>
            )}
          </div>

          {resource.is_ai_generated && (
            <div className="absolute bottom-2 left-2 z-10 bg-black/40 backdrop-blur-md text-white text-[8px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-white/10 flex items-center gap-1 uppercase">
              <Sparkles className="h-2.5 w-2.5 text-primary-400" />
              IA Gerada
            </div>
          )}

          {/* Minimalist Overlay on hover */}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-white drop-shadow-md truncate max-w-[150px] tracking-tight">
                  {resource.title}
                </span>
                <span className="text-[8px] font-semibold text-primary-400 drop-shadow-md flex items-center gap-1.5 tracking-tight mt-0.5">
                  {authorName}
                  {resource.is_official && (
                    <Image src="/images/verificado.svg" alt="Verificado" width={10} height={10} className="w-2.5 h-2.5" />
                  )}
                </span>
              </div>
              <div 
                className="h-8 w-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm"
                onClick={(e) => {
                  e.preventDefault();
                  onFavorite?.(resource.id);
                }}
              >
                <Heart className={`h-4 w-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-500'}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

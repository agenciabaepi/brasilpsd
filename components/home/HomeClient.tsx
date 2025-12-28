'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import ResourceCard from '@/components/resources/ResourceCard'
import type { Resource } from '@/types/database'
import { ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import Link from 'next/link'

interface HomeClientProps {
  officialResources: Resource[]
  popularResources: Resource[]
  latestResources: Resource[]
  freeResources: Resource[]
}

export default function HomeClient({ 
  officialResources, 
  popularResources, 
  latestResources, 
  freeResources 
}: HomeClientProps) {
  const [activeTab, setActiveTab] = useState<'destaques' | 'exclusivos' | 'novos' | 'gratis'>('novos')
  // Tamanho de exibição: 'small' (padrão) ou 'large'
  const [imageSize, setImageSize] = useState<'small' | 'large'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('imageDisplaySize')
      return (saved === 'large' || saved === 'small') ? saved : 'small'
    }
    return 'small'
  })

  // Salvar preferência no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('imageDisplaySize', imageSize)
    }
  }, [imageSize])

  const tabs = [
    { id: 'novos', label: 'Novos', data: latestResources },
    { id: 'destaques', label: 'Destaques', data: officialResources },
    { id: 'exclusivos', label: 'Exclusivos', data: popularResources },
    { id: 'gratis', label: 'Grátis', data: freeResources },
  ] as const

  const currentData = tabs.find(t => t.id === activeTab)?.data || []

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        {/* Tabs Navigation e Controle de Tamanho */}
        <div className="flex justify-between items-center mb-12 border-b border-gray-100">
          <div className="flex space-x-12">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-4 text-lg font-semibold transition-all relative",
                  activeTab === tab.id 
                    ? "text-gray-900" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-500 rounded-full animate-in fade-in zoom-in duration-300" />
                )}
              </button>
            ))}
          </div>
          
          {/* Controle de Tamanho */}
          <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-1">
            <button
              onClick={() => setImageSize('small')}
              className={cn("p-2 rounded-lg transition-all", imageSize === 'small' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
              title="Imagens menores"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setImageSize('large')}
              className={cn("p-2 rounded-lg transition-all", imageSize === 'large' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
              title="Imagens maiores"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <>
          {/* Mobile: Grid 2 colunas */}
          <div className="grid grid-cols-2 gap-1 min-h-[600px] lg:hidden">
            {currentData.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
          {/* Desktop: Masonry Layout */}
          <div className={`hidden lg:block masonry-container min-h-[600px] ${imageSize === 'large' ? 'masonry-large' : 'masonry-small'}`}>
            {currentData.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </>

        {/* View More Button */}
        <div className="mt-16 text-center">
          <Link href="/explore">
            <button className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-semibold text-sm hover:bg-black transition-all flex items-center mx-auto space-x-2">
              <span>Ver todos os recursos</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  )
}


'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import ResourceCard from '@/components/resources/ResourceCard'
import type { Resource } from '@/types/database'
import { ChevronRight } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'destaques' | 'exclusivos' | 'novos' | 'gratis'>('destaques')

  const tabs = [
    { id: 'destaques', label: 'Destaques', data: officialResources },
    { id: 'exclusivos', label: 'Exclusivos', data: popularResources },
    { id: 'novos', label: 'Novos', data: latestResources },
    { id: 'gratis', label: 'Grátis', data: freeResources },
  ] as const

  const currentData = tabs.find(t => t.id === activeTab)?.data || []

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        {/* Tabs Navigation */}
        <div className="flex justify-center mb-12 border-b border-gray-100">
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
        </div>

        {/* Content Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-4 xl:columns-5 2xl:columns-6 gap-6 min-h-[600px]">
          {currentData.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>

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


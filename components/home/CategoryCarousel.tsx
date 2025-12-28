'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Category {
  id: string | null
  name: string
  slug: string
}

interface CategoryCarouselProps {
  categories: Category[]
}

function CategoryCard({ title, href, icon, backgroundImage, hoverImage, backgroundVideo, showTitle = true }: { title: string, href: string, icon: any, backgroundImage?: string, hoverImage?: string, backgroundVideo?: string, showTitle?: boolean }) {
  return (
    <Link href={href} className="group block aspect-square">
      <div className={`rounded-3xl border border-gray-200 p-6 hover:border-primary-300 transition-all w-full h-full aspect-square flex flex-col relative overflow-hidden ${backgroundImage || backgroundVideo ? '' : 'bg-white hover:shadow-xl'}`}>
        {backgroundVideo && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={backgroundVideo} type="video/webm" />
          </video>
        )}
        {backgroundImage && !backgroundVideo && (
          <>
            <Image
              src={backgroundImage}
              alt={title}
              fill
              className="object-cover transition-opacity duration-300 group-hover:opacity-0"
              sizes="(max-width: 768px) 50vw, 20vw"
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={title}
                fill
                className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                sizes="(max-width: 768px) 50vw, 20vw"
              />
            )}
          </>
        )}
        <div className={`relative z-10 flex flex-col h-full ${backgroundImage || backgroundVideo ? 'text-white' : ''}`}>
          {icon && (
            <div className="mb-6 flex justify-center">
              {icon}
            </div>
          )}
          {showTitle && (
            <h3 className={`text-lg font-bold mb-8 group-hover:text-primary-300 transition-colors ${backgroundImage || backgroundVideo ? 'text-white' : 'text-gray-900 group-hover:text-primary-600'}`}>
              {title}
            </h3>
          )}
          {!showTitle && !icon && (
            <div className="flex-1" />
          )}
          <div className={showTitle ? 'mt-auto' : 'mt-auto flex justify-start'}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-900 group-hover:bg-primary-600 transition-colors shadow-md">
              <ChevronRight className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function CategoryCarousel({ categories }: CategoryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingRef = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return

    const startAutoScroll = () => {
      if (isScrollingRef.current) return
      isScrollingRef.current = true

      scrollIntervalRef.current = setInterval(() => {
        if (!scrollContainer) return

        const scrollWidth = scrollContainer.scrollWidth
        const clientWidth = scrollContainer.clientWidth
        const currentScroll = scrollContainer.scrollLeft
        const cardWidth = scrollWidth / (categories.length * 2) // Dividir por 2 porque duplicamos os cards

        let nextScroll = currentScroll + cardWidth
        const halfPoint = scrollWidth / 2

        // Loop infinito: se chegou na metade (fim da primeira sequência), resetar para o início
        if (nextScroll >= halfPoint - cardWidth) {
          // Resetar para o início sem animação para criar loop infinito
          scrollContainer.scrollLeft = 0
          // Aguardar um frame para garantir que o reset foi aplicado
          requestAnimationFrame(() => {
            scrollContainer.scrollTo({
              left: cardWidth,
              behavior: 'smooth'
            })
          })
          return
        }

        scrollContainer.scrollTo({
          left: nextScroll,
          behavior: 'smooth'
        })
      }, 1000) // Move a cada 1 segundo
    }

    // Pausar quando o usuário interage
    const pauseScroll = () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
        scrollIntervalRef.current = null
        isScrollingRef.current = false
      }
    }

    // Retomar após um tempo de inatividade
    const resumeScroll = () => {
      pauseScroll()
      setTimeout(() => {
        startAutoScroll()
      }, 5000) // Retoma após 5 segundos de inatividade
    }

    // Função para atualizar o índice atual baseado no scroll
    const updateCurrentIndex = () => {
      if (!scrollContainer) return
      const cardWidth = scrollContainer.scrollWidth / (categories.length * 2) // Dividir por 2 porque duplicamos os cards
      const scrollLeft = scrollContainer.scrollLeft
      const halfPoint = scrollContainer.scrollWidth / 2
      
      // Se passou da metade, resetar para o início
      if (scrollLeft >= halfPoint) {
        scrollContainer.scrollLeft = scrollLeft - halfPoint
        return
      }
      
      const newIndex = Math.round(scrollLeft / cardWidth) % categories.length
      setCurrentIndex(newIndex)
    }

    startAutoScroll()

    scrollContainer.addEventListener('touchstart', pauseScroll)
    scrollContainer.addEventListener('touchmove', pauseScroll)
    scrollContainer.addEventListener('touchend', resumeScroll)
    scrollContainer.addEventListener('mousedown', pauseScroll)
    scrollContainer.addEventListener('mouseup', resumeScroll)
    scrollContainer.addEventListener('scroll', () => {
      pauseScroll()
      updateCurrentIndex()
    })
    
    // Atualizar índice inicial
    updateCurrentIndex()

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
      }
      scrollContainer.removeEventListener('touchstart', pauseScroll)
      scrollContainer.removeEventListener('touchmove', pauseScroll)
      scrollContainer.removeEventListener('touchend', resumeScroll)
      scrollContainer.removeEventListener('mousedown', pauseScroll)
      scrollContainer.removeEventListener('mouseup', resumeScroll)
      scrollContainer.removeEventListener('scroll', pauseScroll)
    }
  }, [categories.length])

  const getCategoryConfig = (category: Category, index: number) => {
    const slugLower = (category.slug?.toLowerCase() || '').trim()
    const nameLower = (category.name?.toLowerCase() || '').trim()

    let categoryType = 'default'
    if (slugLower === 'mockups' || slugLower.includes('mockup') || nameLower.includes('mockup')) {
      categoryType = 'mockups'
    } else if (slugLower === 'psd' || slugLower.includes('psd') || nameLower.includes('psd')) {
      categoryType = 'psd'
    } else if (slugLower === 'videos' || slugLower.includes('video') || nameLower.includes('vídeo') || nameLower.includes('video')) {
      categoryType = 'videos'
    } else if (slugLower === 'fontes' || slugLower === 'fonts' || slugLower.includes('fonte') || nameLower.includes('fonte')) {
      categoryType = 'fontes'
    } else if (slugLower === 'audios' || slugLower === 'áudios' || slugLower.includes('audio') || nameLower.includes('áudio') || nameLower.includes('audio')) {
      categoryType = 'audios'
    } else {
      const types = ['mockups', 'psd', 'videos', 'fontes', 'audios']
      categoryType = types[index] || 'default'
    }

    let iconElement = null
    let gradientClass = ''

    if (categoryType === 'mockups') {
      gradientClass = 'from-green-400 to-green-600'
      iconElement = null
    } else if (categoryType === 'psd') {
      gradientClass = 'from-blue-400 to-blue-600'
      iconElement = (
        <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">PS</span>
          </div>
        </div>
      )
    } else if (categoryType === 'videos') {
      gradientClass = 'from-purple-400 to-purple-600'
      iconElement = (
        <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-md relative overflow-hidden">
            <div className="w-0 h-0 border-l-[10px] border-l-white border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent ml-0.5"></div>
          </div>
        </div>
      )
    } else if (categoryType === 'fontes') {
      gradientClass = 'from-pink-400 to-pink-600'
      iconElement = (
        <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-700 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">Aa</span>
          </div>
        </div>
      )
    } else if (categoryType === 'audios') {
      gradientClass = 'from-orange-400 to-orange-600'
      iconElement = (
        <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center shadow-md relative px-2">
            <div className="flex space-x-1 items-end">
              <div className="w-1 bg-white rounded-full h-3"></div>
              <div className="w-1 bg-white rounded-full h-4"></div>
              <div className="w-1 bg-white rounded-full h-2.5"></div>
            </div>
          </div>
        </div>
      )
    } else {
      gradientClass = 'from-gray-400 to-gray-600'
      iconElement = (
        <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/50">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-700 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">?</span>
          </div>
        </div>
      )
    }

    return { categoryType, iconElement, gradientClass }
  }

  return (
    <div className="overflow-hidden">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
        onScroll={(e) => {
          const container = e.currentTarget
          const scrollWidth = container.scrollWidth
          const scrollLeft = container.scrollLeft
          const halfPoint = scrollWidth / 2
          
          // Loop infinito: quando chegar perto do final da primeira sequência, resetar para o início
          if (scrollLeft >= halfPoint - 10) {
            // Resetar para o início sem animação para criar loop infinito
            container.scrollLeft = scrollLeft - halfPoint
          }
        }}
      >
        {/* Duplicar os cards para criar loop infinito */}
        {[...categories, ...categories].map((category, index) => {
          const originalIndex = index % categories.length
          const { categoryType, iconElement, gradientClass } = getCategoryConfig(category, originalIndex)

          // Definir imagens/vídeos de capa para cada categoria
          let backgroundImage: string | undefined
          let hoverImage: string | undefined
          let backgroundVideo: string | undefined
          let showTitle = true

          if (categoryType === 'mockups') {
            backgroundImage = '/images/mockup.jpg'
            hoverImage = '/images/mockup-verso.jpg'
            showTitle = false
          } else if (categoryType === 'psd') {
            backgroundImage = '/images/psd.jpg'
            hoverImage = '/images/psd-verso.jpg'
            showTitle = false
          } else if (categoryType === 'videos') {
            backgroundVideo = '/images/video.webm'
            showTitle = false
          } else if (categoryType === 'fontes') {
            backgroundImage = '/images/fontes.jpg'
            hoverImage = '/images/fontes-verso.jpg'
            showTitle = false
          } else if (categoryType === 'audios') {
            backgroundImage = '/images/audios.jpg'
            hoverImage = '/images/audios-verso.jpg'
            showTitle = false
          }

          return (
            <div key={`${category.id || originalIndex}-${Math.floor(index / categories.length)}`} className="flex-shrink-0 w-[calc(100vw-3rem)] snap-center">
              <CategoryCard
                title={category.name}
                href={`/categories/${category.slug}`}
                icon={
                  backgroundImage || backgroundVideo ? null : (
                    <div className={`w-24 h-24 bg-gradient-to-br ${gradientClass} rounded-3xl flex items-center justify-center shadow-xl`}>
                      {iconElement}
                    </div>
                  )
                }
                backgroundImage={backgroundImage}
                hoverImage={hoverImage}
                backgroundVideo={backgroundVideo}
                showTitle={showTitle}
              />
            </div>
          )
        })}
      </div>
      
      {/* Indicadores de paginação (bolinhas) */}
      {categories.length > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          {categories.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (scrollRef.current) {
                  const cardWidth = scrollRef.current.scrollWidth / categories.length
                  scrollRef.current.scrollTo({
                    left: cardWidth * index,
                    behavior: 'smooth'
                  })
                }
              }}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? 'w-2.5 h-2.5 bg-primary-600'
                  : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}


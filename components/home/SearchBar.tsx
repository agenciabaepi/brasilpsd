'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { ResourceType } from '@/types/database'

interface SearchBarProps {
  categories?: any[]
}

const resourceTypeLabels: Record<ResourceType | '', string> = {
  '': 'Todos os tipos',
  'image': 'Imagem',
  'psd': 'PSD',
  'font': 'Fonte',
  'audio': 'Áudio',
  'video': 'Vídeo',
  'ai': 'AI (Illustrator)',
  'other': 'Outros'
}

const resourceTypes: ResourceType[] = ['image', 'psd', 'font', 'audio', 'video', 'ai', 'other']

export default function SearchBar({ categories }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<ResourceType | ''>('')
  const [isTypeOpen, setIsTypeOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const typeDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!isTypeOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      // Verificar se o clique foi fora do botão e do dropdown
      if (
        buttonRef.current && 
        !buttonRef.current.contains(target) &&
        !(target instanceof Element && target.closest('[data-dropdown-menu]'))
      ) {
        setIsTypeOpen(false)
      }
    }

    // Delay para não interferir com o clique inicial
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [isTypeOpen])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    
    if (selectedType) {
      params.set('type', selectedType)
    }
    
    router.push(`/explore?${params.toString()}`)
  }

  function toggleDropdown() {
    if (!isTypeOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
    setIsTypeOpen(prev => !prev)
  }

  function selectType(type: ResourceType | '') {
    setSelectedType(type)
    setIsTypeOpen(false)
  }

  const selectedTypeName = resourceTypeLabels[selectedType] || 'Todos os tipos'

  return (
    <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto" style={{ zIndex: 100 }}>
      <div className="flex items-center bg-white rounded-full border-2 border-gray-200 shadow-lg hover:border-primary-400 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 transition-all">
        {/* Dropdown de Tipo de Arquivo */}
        <div className="relative flex-shrink-0" ref={typeDropdownRef} style={{ zIndex: 100 }}>
          <button
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleDropdown()
            }}
            className="flex items-center gap-2 px-5 py-4 border-r border-gray-200 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer rounded-l-full"
          >
            <span className="whitespace-nowrap">{selectedTypeName}</span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isTypeOpen && typeof window !== 'undefined' && createPortal(
            <div 
              data-dropdown-menu
              className="fixed bg-white border border-gray-200 rounded-xl shadow-2xl py-2 w-56"
              style={{ 
                zIndex: 2147483647,
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                position: 'fixed'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  selectType('')
                }}
                className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                  selectedType === '' 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Todos os tipos
              </button>
              {resourceTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    selectType(type)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {resourceTypeLabels[type]}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
        
        {/* Campo de busca com ícone */}
        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquise por PSD, PNG, Mockups..."
            className="w-full h-16 pl-12 pr-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
        </div>
        
        {/* Botão de pesquisa */}
        <div className="flex-shrink-0 mr-2">
          <Button
            type="submit"
            variant="primary"
            className="rounded-full h-12 px-6"
          >
            Pesquisar
          </Button>
        </div>
      </div>
    </form>
  )
}


'use client'

import { useEffect, useState } from 'react'

/**
 * Componente que ajusta o espaçamento dinamicamente baseado na visibilidade do header
 * Monitora o header e ajusta sua altura quando o header está oculto
 */
export default function HeaderSpacer() {
  const [spacerHeight, setSpacerHeight] = useState(168) // Altura inicial: PromotionalBar (40px) + Header (~128px)

  useEffect(() => {
    // Função para verificar se o header está visível
    const checkHeaderVisibility = () => {
      const header = document.querySelector('header')
      if (header) {
        const style = window.getComputedStyle(header)
        const transform = style.transform
        
        // Se o header está oculto (translate-y-full negativo), reduzir espaçador
        if (transform && transform.includes('translateY') && transform.includes('-')) {
          // Header oculto - manter apenas altura do PromotionalBar
          setSpacerHeight(40)
        } else {
          // Header visível - altura completa
          setSpacerHeight(168)
        }
      }
    }

    // Verificar inicialmente
    checkHeaderVisibility()

    // Observar mudanças no header usando MutationObserver
    const observer = new MutationObserver(() => {
      checkHeaderVisibility()
    })

    const header = document.querySelector('header')
    if (header) {
      observer.observe(header, {
        attributes: true,
        attributeFilter: ['class', 'style']
      })
    }

    // Também verificar periodicamente (fallback)
    const interval = setInterval(checkHeaderVisibility, 100)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])

  return (
    <div 
      className="flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{ height: `${spacerHeight}px` }}
    />
  )
}


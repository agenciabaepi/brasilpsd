'use client'

import { useEffect, useState } from 'react'

/**
 * Hook para detectar se o header está visível
 * Monitora o header e retorna seu estado de visibilidade
 */
export function useHeaderVisibility() {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)

  useEffect(() => {
    const checkHeaderVisibility = () => {
      const header = document.querySelector('header')
      if (header) {
        const style = window.getComputedStyle(header)
        const transform = style.transform
        
        // Se o header está oculto (translate-y-full negativo), retornar false
        if (transform && transform.includes('translateY') && transform.includes('-')) {
          setIsHeaderVisible(false)
        } else {
          setIsHeaderVisible(true)
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

  return isHeaderVisible
}


'use client'

import { useEffect } from 'react'

/**
 * Componente global de proteção de imagens
 * Adiciona proteções adicionais via JavaScript
 */
export default function ImageProtection() {
  useEffect(() => {
    // Bloquear DevTools (tentativa básica)
    const blockDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160
      const heightThreshold = window.outerHeight - window.innerHeight > 160
      
      if (widthThreshold || heightThreshold) {
        // DevTools pode estar aberto
        console.clear()
        console.log('%c⚠️ Acesso Negado', 'color: red; font-size: 50px; font-weight: bold;')
        console.log('%cEsta página está protegida contra inspeção de elementos.', 'color: red; font-size: 20px;')
      }
    }

    // Bloquear atalhos de teclado
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloquear F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+P
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'S' || e.key === 'P'))
      ) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Helper para verificar se é uma imagem ou elemento relacionado
    const isImageElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) {
        return false
      }
      
      const element = target as Element
      return (
        element.tagName === 'IMG' ||
        element.closest('img') !== null ||
        element.closest('[class*="image"]') !== null ||
        element.closest('[class*="preview"]') !== null ||
        element.closest('[class*="thumbnail"]') !== null ||
        element.closest('[class*="resource"]') !== null
      )
    }

    // Bloquear right-click em imagens
    const handleContextMenu = (e: MouseEvent) => {
      if (isImageElement(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Bloquear drag de imagens
    const handleDragStart = (e: DragEvent) => {
      if (isImageElement(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Bloquear seleção de imagens
    const handleSelectStart = (e: Event) => {
      if (isImageElement(e.target)) {
        e.preventDefault()
        return false
      }
    }

    // Adicionar listeners
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('dragstart', handleDragStart)
    document.addEventListener('selectstart', handleSelectStart)

    // Verificar DevTools periodicamente
    const interval = setInterval(blockDevTools, 1000)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('dragstart', handleDragStart)
      document.removeEventListener('selectstart', handleSelectStart)
      clearInterval(interval)
    }
  }, [])

  return null
}


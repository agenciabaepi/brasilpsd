'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ResourceViewContextType {
  selectedResourceId: string | null
  openResourceView: (resourceId: string) => void
  closeResourceView: () => void
}

const ResourceViewContext = createContext<ResourceViewContextType | undefined>(undefined)

export function ResourceViewProvider({ children }: { children: ReactNode }) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)

  const openResourceView = (resourceId: string) => {
    setSelectedResourceId(resourceId)
  }

  const closeResourceView = () => {
    setSelectedResourceId(null)
  }

  return (
    <ResourceViewContext.Provider value={{ selectedResourceId, openResourceView, closeResourceView }}>
      {children}
    </ResourceViewContext.Provider>
  )
}

export function useResourceView() {
  const context = useContext(ResourceViewContext)
  if (context === undefined) {
    throw new Error('useResourceView must be used within a ResourceViewProvider')
  }
  return context
}


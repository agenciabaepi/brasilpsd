'use client'

import { useResourceView } from '@/contexts/ResourceViewContext'
import ResourceViewModal from '@/components/resources/ResourceViewModal'

export default function ResourceViewModalWrapper() {
  const { selectedResourceId, closeResourceView } = useResourceView()
  
  return (
    <ResourceViewModal
      resourceId={selectedResourceId}
      isOpen={!!selectedResourceId}
      onClose={closeResourceView}
    />
  )
}


'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
import ResourceDetailClient from './ResourceDetailClient'
import type { Resource, Profile } from '@/types/database'

interface ResourceViewModalProps {
  resourceId: string | null
  isOpen: boolean
  onClose: () => void
}

export default function ResourceViewModal({ resourceId, isOpen, onClose }: ResourceViewModalProps) {
  const [resource, setResource] = useState<Resource | null>(null)
  const [user, setUser] = useState<Profile | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!isOpen || !resourceId) {
      setResource(null)
      return
    }

    async function loadResource() {
      setLoading(true)
      try {
        // Buscar recurso
        const { data: resourceData, error: resourceError } = await supabase
          .from('resources')
          .select('*, creator:profiles!creator_id(*)')
          .eq('id', resourceId)
          .single()

        if (resourceError || !resourceData) {
          console.error('Erro ao carregar recurso:', resourceError)
          return
        }

        setResource(resourceData)

        // Incrementar visualização
        await supabase.rpc('increment', {
          table_name: 'resources',
          column_name: 'view_count',
          row_id: resourceId,
        })

        // Buscar usuário e favorito
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()
          setUser(profile || null)

          const { data: favorite } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', authUser.id)
            .eq('resource_id', resourceId)
            .single()
          setIsFavorited(!!favorite)
        }
      } catch (error) {
        console.error('Erro ao carregar recurso:', error)
      } finally {
        setLoading(false)
      }
    }

    loadResource()
  }, [isOpen, resourceId, supabase])

  // Fechar modal com ESC
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevenir scroll do body quando modal está aberto
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !resourceId) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        // Fechar ao clicar no backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-7xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" data-resource-modal>
        {/* Header com botão fechar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Visualizar Recurso</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
            </div>
          ) : resource ? (
            <div className="p-0">
              <ResourceDetailClient
                resource={resource}
                initialUser={user}
                initialIsFavorited={isFavorited}
                initialDownloadStatus={null}
                initialAlreadyDownloadedToday={false}
                collection={null}
                collectionResources={[]}
                relatedResources={[]}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-32">
              <p className="text-gray-500">Recurso não encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


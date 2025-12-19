'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Clock, FileCheck, FolderOpen } from 'lucide-react'
import type { Resource, Collection, Profile } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

type TabType = 'resources' | 'collections'

export default function AdminApprovalsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('resources')
  const [resources, setResources] = useState<Resource[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<Profile | null>(null)
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      if (activeTab === 'resources') {
        loadPendingResources()
      } else {
        loadPendingCollections()
      }
    }
  }, [activeTab, user])

  async function loadUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setUser(profile)
    }
  }

  async function loadPendingResources() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setResources(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar recursos pendentes')
    } finally {
      setLoading(false)
    }
  }

  async function loadPendingCollections() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      
      if (error) throw error

      // Buscar contagem de recursos para cada coleção
      const collectionsWithCount = await Promise.all(
        (data || []).map(async (collection: any) => {
          const { count } = await supabase
            .from('collection_resources')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id)

          return {
            ...collection,
            resources_count: count || 0
          }
        })
      )

      setCollections(collectionsWithCount || [])
    } catch (error: any) {
      toast.error('Erro ao carregar coleções pendentes')
    } finally {
      setLoading(false)
    }
  }

  async function handleResourceAction(id: string, status: 'approved' | 'rejected') {
    let reason = ''
    if (status === 'rejected') {
      reason = prompt('Motivo da rejeição:') || ''
      if (!reason) return
    }

    try {
      const { error } = await supabase
        .from('resources')
        .update({ 
          status,
          rejected_reason: reason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      toast.success(status === 'approved' ? 'Recurso aprovado' : 'Recurso rejeitado')
      setResources(resources.filter(r => r.id !== id))
    } catch (error: any) {
      toast.error('Erro ao processar ação')
    }
  }

  async function handleCollectionAction(id: string, status: 'approved' | 'rejected') {
    let reason = ''
    if (status === 'rejected') {
      reason = prompt('Motivo da rejeição:') || ''
      if (!reason) return
    }

    try {
      const { error } = await supabase
        .from('collections')
        .update({ 
          status,
          rejected_reason: reason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      toast.success(status === 'approved' ? 'Coleção aprovada' : 'Coleção rejeitada')
      setCollections(collections.filter(c => c.id !== id))
    } catch (error: any) {
      toast.error('Erro ao processar ação')
    }
  }

  const items = activeTab === 'resources' ? resources : collections
  const isEmpty = items.length === 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Fila de Aprovação</h1>
        <p className="text-gray-500 text-sm mt-1">Revise e aprove arquivos e coleções enviados pelos criadores.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('resources')}
          className={cn(
            "px-6 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === 'resources'
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Recursos ({resources.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={cn(
            "px-6 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === 'collections'
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Coleções ({collections.length})
          </div>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          Carregando fila...
        </div>
      ) : !isEmpty ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeTab === 'resources' ? (
            resources.map((resource) => (
              <Card key={resource.id} className="border-none p-6 flex flex-col gap-6 hover:shadow-md transition-all">
                <div className="flex gap-4">
                  <div className="h-24 w-24 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                    {resource.thumbnail_url && (
                      <img src={getS3Url(resource.thumbnail_url)} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-bold uppercase tracking-widest rounded">Pendente</span>
                      <span className="text-[10px] text-gray-400 font-medium">{new Date(resource.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 truncate">{resource.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{resource.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center">
                        <FileCheck className="h-3 w-3 text-gray-400" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">{(resource as any).creator?.full_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-50">
                  <button 
                    onClick={() => handleResourceAction(resource.id, 'approved')}
                    className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Aprovar
                  </button>
                  <button 
                    onClick={() => handleResourceAction(resource.id, 'rejected')}
                    className="flex-1 h-10 bg-white text-red-500 border border-red-100 hover:bg-red-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Rejeitar
                  </button>
                </div>
              </Card>
            ))
          ) : (
            collections.map((collection) => (
              <Card key={collection.id} className="border-none p-6 flex flex-col gap-6 hover:shadow-md transition-all">
                <div className="flex gap-4">
                  <div className="h-24 w-24 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                    {collection.cover_image ? (
                      <img src={getS3Url(collection.cover_image)} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gray-50">
                        <FolderOpen className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-bold uppercase tracking-widest rounded">Pendente</span>
                      <span className="text-[10px] text-gray-400 font-medium">{new Date(collection.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 truncate">{collection.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{collection.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center">
                          <FolderOpen className="h-3 w-3 text-gray-400" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">{(collection as any).creator?.full_name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">{collection.resources_count || 0} recursos</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-50">
                  <button 
                    onClick={() => handleCollectionAction(collection.id, 'approved')}
                    className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Aprovar
                  </button>
                  <button 
                    onClick={() => handleCollectionAction(collection.id, 'rejected')}
                    className="flex-1 h-10 bg-white text-red-500 border border-red-100 hover:bg-red-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Rejeitar
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="py-32 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center">
          <Clock className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">Tudo em dia!</h3>
          <p className="text-gray-500 text-sm">
            Não há {activeTab === 'resources' ? 'recursos' : 'coleções'} aguardando aprovação no momento.
          </p>
        </div>
      )}
    </div>
  )
}


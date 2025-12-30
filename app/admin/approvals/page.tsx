'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Clock, FileCheck, FolderOpen, Package, ChevronDown, ChevronUp, Eye } from 'lucide-react'
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
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())
  const [familyGroups, setFamilyGroups] = useState<Map<string, Resource[]>>(new Map())
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
      
      const resourcesData = data || []
      
      // Agrupar fontes por família
      const families = new Map<string, Resource[]>()
      const standaloneResources: Resource[] = []
      const processedIds = new Set<string>()
      
      resourcesData.forEach((resource) => {
        // Se já foi processado, pular
        if (processedIds.has(resource.id)) return
        
        if (resource.resource_type === 'font') {
          const familyId = resource.font_family_id || resource.id
          
          // Verificar se há outras fontes da mesma família
          const familyMembers = resourcesData.filter(r => 
            r.resource_type === 'font' && 
            (r.font_family_id === familyId || (r.id === familyId && !r.font_family_id))
          )
          
          if (familyMembers.length > 1) {
            // É uma família - agrupar
            if (!families.has(familyId)) {
              families.set(familyId, familyMembers)
              // Marcar todos como processados
              familyMembers.forEach(r => processedIds.add(r.id))
            }
          } else {
            // Fonte única
            standaloneResources.push(resource)
            processedIds.add(resource.id)
          }
        } else {
          // Não é fonte, adicionar como standalone
          standaloneResources.push(resource)
          processedIds.add(resource.id)
        }
      })
      
      setFamilyGroups(families)
      setResources(standaloneResources)
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
      
      // Remover também das famílias se estiver lá
      familyGroups.forEach((family, familyId) => {
        const updatedFamily = family.filter(r => r.id !== id)
        if (updatedFamily.length === 0) {
          familyGroups.delete(familyId)
        } else {
          familyGroups.set(familyId, updatedFamily)
        }
      })
      setFamilyGroups(new Map(familyGroups))
    } catch (error: any) {
      toast.error('Erro ao processar ação')
    }
  }

  async function handleFamilyAction(familyId: string, status: 'approved' | 'rejected') {
    const family = familyGroups.get(familyId)
    if (!family || family.length === 0) return

    let reason = ''
    if (status === 'rejected') {
      reason = prompt('Motivo da rejeição (aplicado a toda a família):') || ''
      if (!reason) return
    }

    try {
      const familyResourceIds = family.map(r => r.id)
      
      const { error } = await supabase
        .from('resources')
        .update({ 
          status,
          rejected_reason: reason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .in('id', familyResourceIds)
      
      if (error) throw error
      toast.success(status === 'approved' 
        ? `Família completa aprovada (${family.length} fontes)` 
        : `Família completa rejeitada (${family.length} fontes)`)
      
      // Remover família do mapa
      familyGroups.delete(familyId)
      setFamilyGroups(new Map(familyGroups))
    } catch (error: any) {
      toast.error('Erro ao processar ação da família')
    }
  }

  function toggleFamilyExpansion(familyId: string) {
    const newExpanded = new Set(expandedFamilies)
    if (newExpanded.has(familyId)) {
      newExpanded.delete(familyId)
    } else {
      newExpanded.add(familyId)
    }
    setExpandedFamilies(newExpanded)
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
  const totalPendingResources = resources.length + Array.from(familyGroups.values()).reduce((sum, family) => sum + family.length, 0)
  const isEmpty = items.length === 0 && familyGroups.size === 0

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
            Recursos ({totalPendingResources})
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
        <div className="space-y-6">
          {activeTab === 'resources' ? (
            <>
              {/* Famílias de Fontes Agrupadas */}
              {Array.from(familyGroups.entries()).map(([familyId, family]) => {
                const mainFont = family.find(r => !r.font_family_id || r.font_family_id === r.id) || family[0]
                const isExpanded = expandedFamilies.has(familyId)
                
                return (
                  <Card key={`family-${familyId}`} className="border-2 border-primary-200 bg-primary-50/30 p-6">
                    {/* Header da Família */}
                    <div className="flex gap-4 mb-4">
                      <div className="h-24 w-24 rounded-2xl bg-primary-100 border-2 border-primary-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <Package className="h-10 w-10 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-primary-500 text-white text-[8px] font-bold uppercase tracking-widest rounded flex items-center gap-1">
                            <Package className="h-2.5 w-2.5" />
                            Família ({family.length} fontes)
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{new Date(mainFont.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 truncate">{mainFont.title}</h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{mainFont.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center">
                            <FileCheck className="h-3 w-3 text-gray-400" />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">{(mainFont as any).creator?.full_name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botão para expandir/recolher */}
                    <button
                      onClick={() => toggleFamilyExpansion(familyId)}
                      className="w-full mb-4 px-4 py-2 bg-white border border-primary-200 rounded-lg text-[10px] font-bold text-primary-600 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Ocultar {family.length} fontes da família
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Ver {family.length} fontes da família
                        </>
                      )}
                    </button>

                    {/* Lista de fontes da família (expandida) */}
                    {isExpanded && (
                      <div className="mb-4 space-y-3 bg-white rounded-lg p-4 border border-primary-100">
                        {family.map((font) => (
                          <div key={font.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-12 w-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                                  {font.thumbnail_url ? (
                                    <img src={getS3Url(font.thumbnail_url)} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-gray-50">
                                      <FileCheck className="h-6 w-6 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">{font.title}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {font.font_weight && `Peso: ${font.font_weight}`}
                                    {font.font_style && font.font_weight && ' • '}
                                    {font.font_style && `Estilo: ${font.font_style}`}
                                  </p>
                                </div>
                              </div>
                              <Link href={`/resources/${font.id}`} target="_blank">
                                <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all" title="Visualizar">
                                  <Eye className="h-4 w-4" />
                                </button>
                              </Link>
                            </div>
                            {/* Botões individuais para cada fonte */}
                            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                              <button 
                                onClick={() => handleResourceAction(font.id, 'approved')}
                                className="flex-1 h-8 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Aprovar
                              </button>
                              <button 
                                onClick={() => handleResourceAction(font.id, 'rejected')}
                                className="flex-1 h-8 bg-white text-red-500 border border-red-100 hover:bg-red-50 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Rejeitar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botões de Ação da Família */}
                    <div className="flex gap-2 pt-4 border-t border-primary-200">
                      <button 
                        onClick={() => handleFamilyAction(familyId, 'approved')}
                        className="flex-1 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar Família ({family.length})
                      </button>
                      <button 
                        onClick={() => handleFamilyAction(familyId, 'rejected')}
                        className="flex-1 h-10 bg-white text-red-500 border border-red-100 hover:bg-red-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar Família
                      </button>
                    </div>
                  </Card>
                )
              })}

              {/* Recursos Individuais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resources.map((resource) => (
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
                    className="flex-1 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
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
                ))}
              </div>
            </>
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
                    className="flex-1 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
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


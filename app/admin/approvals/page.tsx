'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Clock, FileCheck } from 'lucide-react'
import type { Resource } from '@/types/database'
import { getS3Url } from '@/lib/aws/s3'
import toast from 'react-hot-toast'

export default function AdminApprovalsPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadPending()
  }, [])

  async function loadPending() {
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
      toast.error('Erro ao carregar pendentes')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id: string, status: 'approved' | 'rejected') {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Fila de Aprovação</h1>
        <p className="text-gray-500 text-sm mt-1">Revise e aprove os arquivos enviados pelos criadores.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          Carregando fila...
        </div>
      ) : resources.length > 0 ? (
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
                  onClick={() => handleAction(resource.id, 'approved')}
                  className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aprovar
                </button>
                <button 
                  onClick={() => handleAction(resource.id, 'rejected')}
                  className="flex-1 h-10 bg-white text-red-500 border border-red-100 hover:bg-red-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Rejeitar
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-32 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center">
          <Clock className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">Tudo em dia!</h3>
          <p className="text-gray-500 text-sm">Não há recursos aguardando aprovação no momento.</p>
        </div>
      )}
    </div>
  )
}


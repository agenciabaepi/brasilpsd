'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase/client'
import { 
  Download, 
  Heart, 
  Share2, 
  Flag, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  FileText,
  ShieldCheck,
  Sparkles,
  Crown,
  UserPlus,
  Check
} from 'lucide-react'
import type { Resource, Profile } from '@/types/database'
import { formatFileSize } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { getS3Url } from '@/lib/aws/s3'
import { cn } from '@/lib/utils/cn'
import { isSystemProfileSync } from '@/lib/utils/system'

interface ResourceDetailClientProps {
  resource: Resource
  initialIsFavorited: boolean
}

export default function ResourceDetailClient({ resource, initialIsFavorited }: ResourceDetailClientProps) {
  const router = useRouter()
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [downloading, setDownloading] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [isFollowingCreator, setIsFollowingCreator] = useState(false)
  const supabase = createSupabaseClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setUser(profile)

        // Verificar se está seguindo o criador
        if (resource.creator_id && authUser.id !== resource.creator_id) {
          const { data: followData } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', authUser.id)
            .eq('creator_id', resource.creator_id)
            .single()
          setIsFollowingCreator(!!followData)
        }
      }
    }
    loadUser()
  }, [resource.creator_id])

  // Se for oficial ou o creator_id for do sistema, usar o perfil do sistema
  const isOfficial = resource.is_official || isSystemProfileSync(resource.creator_id)
  const authorName = isOfficial ? (resource.creator?.full_name || 'BrasilPSD') : (resource.creator?.full_name || 'BrasilPSD')

  async function handleFavorite() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Você precisa estar logado')
      return
    }

    if (isFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resource.id)

      if (!error) {
        setIsFavorited(false)
        toast.success('Removido dos favoritos')
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          resource_id: resource.id,
        })

      if (!error) {
        setIsFavorited(true)
        toast.success('Adicionado aos favoritos')
      }
    }
  }

  async function handleDownload() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      toast.error('Você precisa estar logado para baixar')
      router.push('/login')
      return
    }

    // Double check premium status on client side
    if (resource.is_premium && !user?.is_premium) {
      toast.error('Este arquivo é exclusivo para membros Premium')
      router.push('/premium')
      return
    }

    setDownloading(true)

    try {
      const url = new URL(resource.file_url)
      const key = url.pathname.substring(1)

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, key }),
      })
      
      const downloadData = await response.json()

      if (downloadData.error) throw new Error(downloadData.error)

      await supabase.from('downloads').insert({
        user_id: user.id,
        resource_id: resource.id,
      })

      await supabase.rpc('increment', {
        table_name: 'resources',
        column_name: 'download_count',
        row_id: resource.id,
      })

      window.open(downloadData.url, '_blank')
      toast.success('Download iniciado!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao baixar recurso')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-8 space-y-8">
          {/* Preview Image */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center min-h-[400px] group relative shadow-sm">
            {resource.thumbnail_url ? (
              <Image
                src={getS3Url(resource.thumbnail_url)}
                alt={resource.title}
                width={1200}
                height={800}
                priority
                className="max-w-full h-auto object-contain"
              />
            ) : (
              <div className="aspect-video w-full flex flex-col items-center justify-center bg-gray-50">
                <FileText className="h-16 w-16 text-gray-200 mb-4" />
                <p className="text-gray-400 font-semibold tracking-widest text-sm uppercase">Sem Prévia</p>
              </div>
            )}
          </div>

          {/* Interaction Bar */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-8">
              <button onClick={handleFavorite} className="flex items-center space-x-2 text-gray-600 hover:text-red-500 transition-colors group">
                <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="text-base font-semibold tracking-tight">{isFavorited ? 'Salvo' : 'Salvar'}</span>
              </button>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-secondary-500 transition-colors group">
                <Share2 className="h-5 w-5" />
                <span className="text-base font-semibold tracking-tight">Compartilhar</span>
              </button>
            </div>
            <button className="text-gray-300 hover:text-gray-600 transition-colors">
              <Flag className="h-5 w-5" />
            </button>
          </div>

          {/* Information Area */}
          <div className="bg-white rounded-2xl p-10 border border-gray-100 space-y-10 shadow-sm">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 tracking-tighter flex items-center">
                <span className="h-6 w-1.5 bg-primary-500 mr-3 rounded-full" />
                Informações Técnicas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-16">
                <div className="space-y-4">
                  <InfoRow label="Formato do arquivo" value={resource.file_format?.toUpperCase()} />
                  <InfoRow label="Tamanho" value={formatFileSize(resource.file_size)} />
                  <InfoRow label="Licença" value={resource.is_premium ? 'Premium' : 'Gratuita'} />
                  {resource.is_ai_generated && (
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Origem:</span>
                      <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                        <Sparkles className="h-3 w-3" />
                        IA Gerada
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <InfoRow label="Extensão de download" value="zip" />
                  <InfoRow label="Identificação" value={`#${resource.id.substring(0, 8)}`} />
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-gray-100">
              <p className="text-gray-700 leading-relaxed text-base font-medium">
                {resource.description || 'Este recurso digital foi projetado para oferecer a máxima qualidade e facilidade de uso em seus projetos criativos. Ideal para designers que buscam agilidade e profissionalismo.'}
              </p>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (SIDEBAR) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-3xl p-10 border border-gray-100 sticky top-24 shadow-sm">
            {/* Header Sidebar */}
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight tracking-tighter">
                    {resource.title}
                  </h1>
                  {resource.is_premium && (
                    <span className="bg-gray-900 text-yellow-400 p-2 rounded-full flex-shrink-0 shadow-lg border border-gray-800">
                      <Crown className="h-5 w-5 fill-yellow-400" />
                    </span>
                  )}
                </div>
            </div>

            {/* Checklist */}
            <div className="space-y-4 py-6 border-y border-gray-50">
              <CheckItem text={`Arquivo ${resource.file_format?.toUpperCase()} totalmente editável`} />
              <CheckItem text="Uso comercial e pessoal liberado" />
              <CheckItem text="Não exige atribuição de créditos" />
              <CheckItem text="Qualidade premium verificada" />
              <CheckItem text="Acesso imediato após confirmação" />
            </div>

            {/* Premium Highlight */}
            {resource.is_premium && (
              <div className="bg-primary-50/50 rounded-2xl p-6 border border-primary-100 flex items-start space-x-4 my-8">
                <AlertCircle className="h-6 w-6 text-secondary-600 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 tracking-tighter">Recurso Assinante</p>
                  <p className="text-sm text-gray-700 font-bold leading-relaxed tracking-tight">
                    Disponível apenas para membros premium. Faça o upgrade agora!
                  </p>
                </div>
              </div>
            )}

            {/* Download Button */}
            {!user ? (
              <Link href={resource.is_premium ? "/premium" : "/signup"} className="block mt-8">
                <button
                  className={cn(
                    "w-full h-16 rounded-2xl flex items-center justify-center space-x-3 font-bold text-sm tracking-widest transition-all shadow-lg uppercase",
                    resource.is_premium 
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20" 
                      : "bg-gray-900 hover:bg-black text-white shadow-gray-900/20"
                  )}
                >
                  {resource.is_premium ? (
                    <>
                      <Crown className="h-5 w-5" />
                      <span>Quero ser Premium para Baixar</span>
                    </>
                  ) : (
                    <>
                      <User className="h-5 w-5" />
                      <span>Crie uma conta para Baixar</span>
                    </>
                  )}
                </button>
              </Link>
            ) : resource.is_premium && !user.is_premium ? (
              <Link href="/premium" className="block mt-8">
                <button className="w-full h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center space-x-3 font-bold text-sm tracking-widest transition-all shadow-lg shadow-orange-500/20 uppercase">
                  <Crown className="h-5 w-5" />
                  <span>Assine Premium para Baixar</span>
                </button>
              </Link>
            ) : (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full h-16 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl flex items-center justify-center space-x-3 font-semibold text-sm tracking-widest transition-all disabled:opacity-50 group mt-8 shadow-lg shadow-primary-500/20"
              >
                <Download className="h-5 w-5 group-hover:translate-y-1 transition-transform" />
                <span>Baixar Agora ({formatFileSize(resource.file_size)})</span>
              </button>
            )}

            {/* Author Section */}
            <div className="pt-8 border-t border-gray-100 flex items-center justify-between mt-8">
              {isOfficial || !resource.creator_id || isSystemProfileSync(resource.creator_id) ? (
                <div className="flex items-center space-x-4">
                  <div className="h-14 w-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden">
                    {resource.is_official ? (
                      <Image src="/images/verificado.svg" alt="Verificado" width={32} height={32} />
                    ) : resource.creator?.avatar_url ? (
                      <Image 
                        src={resource.creator.avatar_url} 
                        alt={authorName} 
                        width={56} 
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-gray-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-bold text-gray-900">{authorName}</p>
                      {isOfficial && (
                        <Image src="/images/verificado.svg" alt="Oficial" width={14} height={14} />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-bold tracking-widest mt-0.5 uppercase">
                      {isOfficial ? 'Equipe Oficial' : 'Criador Verificado'}
                    </p>
                  </div>
                </div>
              ) : (
                <Link 
                  href={`/creator/${resource.creator_id}`}
                  className="flex items-center space-x-4 hover:opacity-80 transition-opacity"
                >
                  <div className="h-14 w-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden">
                    {resource.creator?.avatar_url ? (
                      <Image 
                        src={resource.creator.avatar_url} 
                        alt={authorName} 
                        width={56} 
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-gray-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-bold text-gray-900">{authorName}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-bold tracking-widest mt-0.5 uppercase">
                      Criador Verificado
                    </p>
                  </div>
                </Link>
              )}
              {!isOfficial && resource.creator_id && !isSystemProfileSync(resource.creator_id) && (
                <button 
                  onClick={async () => {
                    const { data: { user: authUser } } = await supabase.auth.getUser()
                    if (!authUser) {
                      toast.error('Você precisa estar logado para seguir')
                      return
                    }

                    if (isFollowingCreator) {
                      const { error } = await supabase
                        .from('followers')
                        .delete()
                        .eq('follower_id', authUser.id)
                        .eq('creator_id', resource.creator_id)

                      if (!error) {
                        setIsFollowingCreator(false)
                        toast.success('Você deixou de seguir')
                      }
                    } else {
                      const { error } = await supabase
                        .from('followers')
                        .insert({
                          follower_id: authUser.id,
                          creator_id: resource.creator_id,
                        })

                      if (!error) {
                        setIsFollowingCreator(true)
                        toast.success('Você está seguindo este criador')
                      }
                    }
                  }}
                  className={cn(
                    "px-5 py-2.5 text-xs font-bold rounded-xl transition-colors",
                    isFollowingCreator
                      ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      : "bg-gray-900 text-white hover:bg-black"
                  )}
                >
                  {isFollowingCreator ? 'Seguindo' : 'Seguir'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center space-x-3">
      <CheckCircle2 className="h-5 w-5 text-secondary-600 flex-shrink-0" />
      <span className="text-sm font-semibold text-gray-700 tracking-tight uppercase">{text}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
      <span className="text-xs font-semibold text-gray-600 tracking-widest uppercase">{label}:</span>
      <span className="text-sm font-semibold text-gray-900 tracking-tight">{value}</span>
    </div>
  )
}

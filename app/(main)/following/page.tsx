'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { Users, UserPlus } from 'lucide-react'
import { getS3Url } from '@/lib/aws/s3'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function FollowingPage() {
  const [following, setFollowing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadFollowing()
  }, [])

  async function loadFollowing() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Buscar criadores que o usuário está seguindo
      // Nota: A tabela followers precisa existir (já criada na migration 008)
      const { data, error } = await supabase
        .from('followers')
        .select('*, creator:profiles!followers_creator_id_fkey(*)')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        // Se a tabela não existir, apenas mostrar mensagem
        console.warn('Tabela followers não encontrada:', error)
        setFollowing([])
        return
      }
      
      setFollowing(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar seguindo:', error)
      setFollowing([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Seguindo</h1>
          <p className="text-gray-600">
            {following.length} {following.length === 1 ? 'criador' : 'criadores'}
          </p>
        </div>

        {following.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {following.map((follow) => (
              follow.creator && (
                <Card key={follow.id} className="p-6">
                  <Link href={`/creator/${follow.creator.id}`}>
                    <div className="flex items-center space-x-4">
                      <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                        {follow.creator.avatar_url ? (
                          <Image
                            src={getS3Url(follow.creator.avatar_url)}
                            alt={follow.creator.full_name || 'Criador'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-secondary-500 to-primary-500">
                            <Users className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {follow.creator.full_name || 'Criador'}
                        </h3>
                        <p className="text-sm text-gray-500">{follow.creator.email}</p>
                      </div>
                    </div>
                  </Link>
                </Card>
              )
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <UserPlus className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-4">Você ainda não está seguindo nenhum criador</p>
            <Link
              href="/explore"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Explorar criadores
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}


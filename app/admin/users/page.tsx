'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Search, User, ShieldCheck, Star, Trash2, ShieldAlert } from 'lucide-react'
import type { Profile } from '@/types/database'
import toast from 'react-hot-toast'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'creator' | 'admin'>('all')
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadUsers()
  }, [roleFilter])

  async function loadUsers() {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (roleFilter === 'creator') {
        query = query.eq('is_creator', true)
      } else if (roleFilter === 'admin') {
        query = query.eq('is_admin', true)
      } else if (roleFilter === 'user') {
        query = query.eq('is_creator', false).eq('is_admin', false)
      }

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      setUsers(data || [])
    } catch (error: any) {
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  async function toggleCreator(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_creator: !currentStatus })
        .eq('id', id)
      
      if (error) throw error
      toast.success(`Usuário ${!currentStatus ? 'promovido a criador' : 'removido de criadores'}`)
      loadUsers()
    } catch (error: any) {
      toast.error('Erro ao atualizar status')
    }
  }

  async function toggleAdmin(id: string, currentStatus: boolean) {
    if (!confirm('ATENÇÃO: Você tem certeza que deseja alterar os privilégios de administrador deste usuário?')) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', id)
      
      if (error) throw error
      toast.success(`Privilégios de admin ${!currentStatus ? 'concedidos' : 'removidos'}`)
      loadUsers()
    } catch (error: any) {
      toast.error('Erro ao atualizar privilégios')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestão de Usuários</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie permissões e visualize todos os membros da plataforma.</p>
      </div>

      <Card className="border-none p-0 overflow-hidden">
        {/* Filters Bar */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Pesquisar por nome ou e-mail..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'user', 'creator', 'admin'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  roleFilter === role 
                    ? 'bg-gray-900 text-white shadow-lg' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {role === 'all' ? 'Todos' : role === 'creator' ? 'Criadores' : role === 'admin' ? 'Admins' : 'Usuários'}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mail</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Função</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data de Cadastro</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 text-sm font-medium">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    Carregando membros...
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{user.full_name || 'Sem nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{user.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.is_admin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-600 text-[8px] font-bold uppercase tracking-widest border border-red-100">
                            Admin
                          </span>
                        )}
                        {user.is_creator && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-50 text-primary-600 text-[8px] font-bold uppercase tracking-widest border border-primary-100">
                            Criador
                          </span>
                        )}
                        {!user.is_admin && !user.is_creator && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-gray-500 text-[8px] font-bold uppercase tracking-widest border border-gray-100">
                            Usuário
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-400 font-medium">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toggleCreator(user.id, user.is_creator)}
                          className={`p-2 rounded-lg transition-all ${user.is_creator ? 'text-primary-500 bg-primary-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          title={user.is_creator ? 'Remover Criador' : 'Tornar Criador'}
                        >
                          <Star className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => toggleAdmin(user.id, user.is_admin)}
                          className={`p-2 rounded-lg transition-all ${user.is_admin ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          title={user.is_admin ? 'Remover Admin' : 'Tornar Admin'}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 text-sm font-medium">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


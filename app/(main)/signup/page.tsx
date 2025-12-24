'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    cpf_cnpj: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
        },
      })

      if (error) throw error

      // Atualizar perfil com dados adicionais (se fornecidos)
      if (data.user) {
        const updateData: any = {
          full_name: formData.fullName,
        }
        
        if (formData.phone) {
          updateData.phone = formData.phone.replace(/\D/g, '')
        }
        
        if (formData.cpf_cnpj) {
          updateData.cpf_cnpj = formData.cpf_cnpj.replace(/\D/g, '')
        }

        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', data.user.id)
          .catch(err => {
            // Ignorar erro se perfil ainda não foi criado pelo trigger
            console.log('Perfil será criado pelo trigger')
          })
      }

      toast.success('Conta criada com sucesso! Verifique seu email.')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-none">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Criar Conta</h1>
          <p className="text-gray-600">Comece a explorar recursos digitais</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="text"
            label="Nome Completo"
            placeholder="Seu nome"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />

          <Input
            type="email"
            label="Email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Input
            type="tel"
            label="Telefone (opcional)"
            placeholder="(00) 00000-0000"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
            maxLength={15}
          />

          <Input
            type="text"
            label="CPF/CNPJ (opcional)"
            placeholder="000.000.000-00"
            value={formData.cpf_cnpj}
            onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value.replace(/\D/g, '') })}
            maxLength={18}
          />

          <Input
            type="password"
            label="Senha"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <Input
            type="password"
            label="Confirmar Senha"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
          />

          <Button type="submit" className="w-full h-12 rounded-xl font-semibold uppercase tracking-widest text-xs" isLoading={isLoading}>
            Criar Conta
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
              Entrar
            </Link>
          </p>
        </div>
      </Card>
    </main>
  )
}

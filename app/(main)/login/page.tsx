'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success('Login realizado com sucesso!')
      // Usar window.location para garantir que a sessão seja reconhecida
      window.location.href = '/dashboard'
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-none">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Entrar</h1>
          <p className="text-gray-600">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="email"
            label="Email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            type="password"
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-600">Lembrar-me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl font-semibold uppercase tracking-widest text-xs" isLoading={isLoading}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Não tem uma conta?{' '}
            <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-semibold">
              Cadastre-se
            </Link>
          </p>
        </div>
      </Card>
    </main>
  )
}

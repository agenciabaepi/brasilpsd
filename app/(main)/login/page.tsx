'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { AlertCircle, Mail, X } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const supabase = createSupabaseClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    let shouldShowError = true // Flag para controlar se deve mostrar erro

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Se o erro for de credenciais inválidas, verificar se o email existe mas não foi confirmado
        const isCredentialsError = 
          error.message === 'Invalid login credentials' || 
          error.message?.includes('credentials') || 
          error.message?.includes('Invalid') ||
          error.message?.toLowerCase().includes('invalid')
        
        if (isCredentialsError) {
          // Verificar se o email existe e não foi confirmado
          try {
            const checkResponse = await fetch('/api/auth/check-email-verification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            })

            if (!checkResponse.ok) {
              console.error('Erro na resposta da verificação:', checkResponse.status)
            }

            const checkData = await checkResponse.json()
            
            console.log('Verificação de email retornou:', checkData)

            // Se o usuário existe mas o email não foi verificado, mostrar modal (sem toast de erro)
            if (checkData.exists && !checkData.verified) {
              console.log('Email não verificado detectado, mostrando modal')
              shouldShowError = false // Não mostrar toast de erro
              setShowVerificationModal(true)
              setIsLoading(false)
              return // Sair sem mostrar erro
            }
          } catch (checkError) {
            // Se falhar a verificação, continuar com o erro original
            console.error('Erro ao verificar status do email:', checkError)
          }
        }

        // Se não for email não verificado, mostrar erro normal
        throw error
      }

      // Verificar se o email foi confirmado (caso o login tenha funcionado)
      if (data.user && !data.user.email_confirmed_at) {
        // Email não foi verificado, mostrar modal
        shouldShowError = false
        setShowVerificationModal(true)
        setIsLoading(false)
        return
      }

      toast.success('Login realizado com sucesso!')
      // Usar window.location para garantir que a sessão seja reconhecida
      window.location.href = redirectTo
    } catch (error: any) {
      // Só mostrar erro se a flag permitir
      if (shouldShowError) {
        toast.error(error.message || 'Erro ao fazer login')
      }
      setIsLoading(false)
    }
  }


  return (
    <>
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

      {/* Modal de Email Não Verificado */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md border-none relative">
            <button
              onClick={() => setShowVerificationModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Email Não Verificado
              </h2>
              <p className="text-gray-600">
                Sua conta ainda não foi verificada. Por favor, verifique seu email para continuar.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Verifique sua caixa de entrada
                  </p>
                  <p className="text-sm text-blue-700">
                    Enviamos um código de verificação para <strong>{email}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.push(`/verify-email?email=${encodeURIComponent(email)}`)}
                className="w-full h-12 rounded-xl font-semibold uppercase tracking-widest text-xs"
              >
                Ir para Verificação
              </Button>

              <button
                onClick={() => {
                  setShowVerificationModal(false)
                  // Fazer logout para limpar a sessão
                  supabase.auth.signOut()
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-900 font-medium py-2"
              >
                Fazer logout
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

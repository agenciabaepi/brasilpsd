'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!email) {
      router.push('/signup')
    }
  }, [email, router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()

    if (!code || code.length !== 6) {
      toast.error('Por favor, informe o código de 6 dígitos')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar código')
      }

      toast.success('Email verificado com sucesso!')
      
      // Verificar se a conta já existe
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Conta já existe, apenas redirecionar para login
        toast.success('Email verificado! Você já pode fazer login.')
        router.push('/login')
      } else {
        // Conta não existe, criar nova conta
        await createAccount()
      }
    } catch (error: any) {
      toast.error(error.message || 'Código inválido. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  async function createAccount() {
    try {
      // Buscar dados do formulário do sessionStorage
      const signupDataStr = sessionStorage.getItem('signup_data')
      if (!signupDataStr) {
        toast.error('Dados do cadastro não encontrados. Por favor, refaça o cadastro.')
        router.push('/signup')
        return
      }

      const signupData = JSON.parse(signupDataStr)

      // Validar CPF/CNPJ novamente antes de criar a conta (dupla verificação)
      if (signupData.cpf_cnpj) {
        const cleanCpfCnpj = signupData.cpf_cnpj.replace(/\D/g, '')
        if (cleanCpfCnpj.length >= 11) {
          try {
            const checkResponse = await fetch('/api/auth/check-cpf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cpf_cnpj: cleanCpfCnpj })
            })

            const checkData = await checkResponse.json()
            if (checkData.exists) {
              toast.error('Este CPF/CNPJ já está cadastrado. Use outro CPF/CNPJ.')
              return
            }
          } catch (error) {
            console.error('Erro ao verificar CPF/CNPJ antes de criar conta:', error)
            toast.error('Erro ao verificar CPF/CNPJ. Tente novamente.')
            return
          }
        }
      }

      // Criar conta no Supabase
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.fullName,
          },
        },
      })

      if (error) throw error

      // Atualizar perfil com dados adicionais (se fornecidos)
      if (data.user) {
        const updateData: any = {
          full_name: signupData.fullName,
        }
        
        if (signupData.phone) {
          updateData.phone = signupData.phone.replace(/\D/g, '')
        }
        
        if (signupData.cpf_cnpj) {
          updateData.cpf_cnpj = signupData.cpf_cnpj.replace(/\D/g, '')
        }

        // Tentar atualizar perfil (pode falhar se ainda não foi criado pelo trigger)
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', data.user.id)

        // Ignorar erro se perfil ainda não foi criado pelo trigger
        if (updateError && !updateError.message.includes('No rows')) {
          console.error('Erro ao atualizar perfil:', updateError)
        }
      }

      // Limpar dados temporários
      sessionStorage.removeItem('signup_data')

      // Enviar email de boas-vindas (não bloquear se falhar)
      if (data.user && signupData.email) {
        try {
          await fetch('/api/auth/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: signupData.email,
              userName: signupData.fullName || 'Usuário'
            })
          }).catch(() => {
            // Ignorar erros de email (não bloquear criação de conta)
          })
        } catch (emailError) {
          console.error('Erro ao enviar email de boas-vindas:', emailError)
          // Não bloquear criação de conta se email falhar
        }
      }

      toast.success('Conta criada com sucesso!')
      router.push('/login')
    } catch (error: any) {
      console.error('Erro ao criar conta:', error)
      toast.error(error.message || 'Erro ao criar conta')
    }
  }

  async function handleResendCode() {
    setIsResending(true)
    try {
      const response = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao reenviar código')
      }

      toast.success('Código reenviado com sucesso!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reenviar código')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-none">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verificar Email</h1>
          <p className="text-gray-600">
            Enviamos um código de verificação para
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{email}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <Input
            type="text"
            label="Código de Verificação"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            required
            className="text-center text-2xl font-mono tracking-widest"
          />

          <Button 
            type="submit" 
            className="w-full h-12 rounded-xl font-semibold uppercase tracking-widest text-xs" 
            isLoading={isLoading}
          >
            Verificar
          </Button>
        </form>

        <div className="mt-6 space-y-4">
          <button
            onClick={handleResendCode}
            disabled={isResending}
            className="w-full text-sm text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
          >
            {isResending ? 'Reenviando...' : 'Reenviar código'}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Não recebeu o código?{' '}
              <button
                onClick={handleResendCode}
                disabled={isResending}
                className="text-primary-600 hover:text-primary-700 font-semibold disabled:opacity-50"
              >
                Reenviar
              </button>
            </p>
          </div>

          <div className="text-center pt-4 border-t border-gray-100">
            <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Voltar para cadastro
            </Link>
          </div>
        </div>
      </Card>
    </main>
  )
}


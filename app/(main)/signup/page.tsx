'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { validateCPForCNPJ } from '@/lib/utils/cpf-validation'

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
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'checking' | 'valid' | 'duplicate' | 'invalid'>('idle')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'valid' | 'duplicate' | 'invalid'>('idle')
  const cpfCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createSupabaseClient()

  // Verificar CPF em tempo real (com debounce)
  useEffect(() => {
    // Limpar timeout anterior
    if (cpfCheckTimeoutRef.current) {
      clearTimeout(cpfCheckTimeoutRef.current)
    }

    const cleanCpfCnpj = formData.cpf_cnpj.replace(/\D/g, '')
    
    // Se não tem CPF, resetar status
    if (!formData.cpf_cnpj) {
      setCpfStatus('idle')
      return
    }

    // Validar formato mínimo (11 para CPF, 14 para CNPJ)
    if (cleanCpfCnpj.length < 11) {
      setCpfStatus('invalid')
      return
    }

    // Se tem 11 ou 14 dígitos, validar algoritmo de CPF/CNPJ
    if (cleanCpfCnpj.length === 11 || cleanCpfCnpj.length === 14) {
      // Primeiro validar o algoritmo
      const isValidFormat = validateCPForCNPJ(cleanCpfCnpj)
      
      if (!isValidFormat) {
        setCpfStatus('invalid')
        return
      }

      // Se formato é válido, verificar se já existe no banco
      setCpfStatus('checking')
      
      // Debounce: aguardar 500ms após parar de digitar
      cpfCheckTimeoutRef.current = setTimeout(async () => {
        try {
          const checkResponse = await fetch('/api/auth/check-cpf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf_cnpj: cleanCpfCnpj })
          })

          const checkData = await checkResponse.json()
          if (checkData.exists) {
            setCpfStatus('duplicate')
          } else {
            setCpfStatus('valid')
          }
        } catch (error) {
          console.error('Erro ao verificar CPF/CNPJ:', error)
          setCpfStatus('idle')
        }
      }, 500)
    } else {
      // Se tem mais de 11 mas não 14, ainda está digitando
      setCpfStatus('idle')
    }

    return () => {
      if (cpfCheckTimeoutRef.current) {
        clearTimeout(cpfCheckTimeoutRef.current)
      }
    }
  }, [formData.cpf_cnpj])

  // Verificar email em tempo real (com debounce)
  useEffect(() => {
    // Limpar timeout anterior
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current)
    }

    // Validar formato básico de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (!formData.email) {
      setEmailStatus('idle')
      return
    }

    if (!emailRegex.test(formData.email)) {
      setEmailStatus('invalid')
      return
    }

    // Se email tem formato válido, verificar se já existe
    setEmailStatus('checking')
    
    // Debounce: aguardar 800ms após parar de digitar
    emailCheckTimeoutRef.current = setTimeout(async () => {
      try {
        // Verificar via API
        const checkResponse = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        })
        
        const checkData = await checkResponse.json()
        if (checkData.exists) {
          setEmailStatus('duplicate')
        } else {
          setEmailStatus('valid')
        }
      } catch (apiError) {
        console.error('Erro ao verificar email:', apiError)
        setEmailStatus('idle')
      }
    }, 800)

    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current)
      }
    }
  }, [formData.email])

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

    // Validar status de CPF e Email antes de submeter
    if (cpfStatus === 'duplicate') {
      toast.error('Este CPF/CNPJ já está cadastrado')
      return
    }

    if (emailStatus === 'duplicate') {
      toast.error('Este email já está cadastrado')
      return
    }

    if (emailStatus === 'invalid') {
      toast.error('Email inválido')
      return
    }

    // Se está verificando, aguardar um pouco
    if (cpfStatus === 'checking' || emailStatus === 'checking') {
      toast.error('Aguarde a verificação terminar')
      return
    }

    // Validar CPF/CNPJ se fornecido
    if (formData.cpf_cnpj) {
      const cleanCpfCnpj = formData.cpf_cnpj.replace(/\D/g, '')
      
      // Validar formato e algoritmo
      if (!validateCPForCNPJ(cleanCpfCnpj)) {
        setCpfStatus('invalid')
        toast.error('CPF/CNPJ inválido. Verifique os dígitos.')
        return
      }

      // Verificar novamente antes de enviar (última validação)
      if (cpfStatus !== 'valid') {
        try {
          const checkResponse = await fetch('/api/auth/check-cpf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf_cnpj: cleanCpfCnpj })
          })

          const checkData = await checkResponse.json()
          if (checkData.exists) {
            setCpfStatus('duplicate')
            toast.error('Este CPF/CNPJ já está cadastrado')
            return
          }
          setCpfStatus('valid')
        } catch (error) {
          console.error('Erro ao verificar CPF/CNPJ:', error)
          toast.error('Erro ao verificar CPF/CNPJ. Tente novamente.')
          return
        }
      }
    }

    setIsLoading(true)

    try {
      // 1. Primeiro, enviar código de verificação
      const sendCodeResponse = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      })

      const sendCodeData = await sendCodeResponse.json()

      if (!sendCodeResponse.ok) {
        // Se o erro for de email duplicado, atualizar status
        if (sendCodeData.error?.includes('já está cadastrado')) {
          setEmailStatus('duplicate')
        }
        throw new Error(sendCodeData.error || 'Erro ao enviar código de verificação')
      }

      // 2. Guardar dados do formulário no sessionStorage para usar após verificação
      sessionStorage.setItem('signup_data', JSON.stringify({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone,
        cpf_cnpj: formData.cpf_cnpj
      }))

      // 3. Redirecionar para página de verificação
      toast.success('Código de verificação enviado para seu email!')
      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta')
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

          <div>
            <Input
              type="email"
              label="Email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className={emailStatus === 'duplicate' ? 'border-red-500' : emailStatus === 'valid' ? 'border-primary-500' : ''}
            />
            {emailStatus === 'checking' && (
              <p className="mt-1 text-xs text-gray-500 flex items-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                <span>Verificando email...</span>
              </p>
            )}
            {emailStatus === 'duplicate' && (
              <p className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>Este email já está cadastrado</span>
              </p>
            )}
            {emailStatus === 'valid' && (
              <p className="mt-1 text-xs text-primary-600 flex items-center space-x-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Email disponível</span>
              </p>
            )}
            {emailStatus === 'invalid' && formData.email && (
              <p className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>Formato de email inválido</span>
              </p>
            )}
          </div>

          <Input
            type="tel"
            label="Telefone (opcional)"
            placeholder="(00) 00000-0000"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
            maxLength={15}
          />

          <div>
            <Input
              type="text"
              label="CPF/CNPJ (opcional)"
              placeholder="000.000.000-00"
              value={formData.cpf_cnpj}
              onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value.replace(/\D/g, '') })}
              maxLength={18}
              className={cpfStatus === 'duplicate' || cpfStatus === 'invalid' ? 'border-red-500' : cpfStatus === 'valid' ? 'border-primary-500' : ''}
            />
            {cpfStatus === 'checking' && (
              <p className="mt-1 text-xs text-gray-500 flex items-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                <span>Verificando CPF/CNPJ...</span>
              </p>
            )}
            {cpfStatus === 'duplicate' && (
              <p className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>Este CPF/CNPJ já está cadastrado</span>
              </p>
            )}
            {cpfStatus === 'valid' && (
              <p className="mt-1 text-xs text-primary-600 flex items-center space-x-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>CPF/CNPJ válido e disponível</span>
              </p>
            )}
            {cpfStatus === 'invalid' && (
              <p className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>
                  {formData.cpf_cnpj.replace(/\D/g, '').length < 11 
                    ? 'CPF/CNPJ deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)'
                    : 'CPF/CNPJ inválido. Verifique os dígitos'}
                </span>
              </p>
            )}
          </div>

          <Input
            type="password"
            label="Senha"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            className={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 6 ? 'border-primary-500' : ''}
          />

          <div>
            <Input
              type="password"
              label="Confirmar Senha"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 6 ? 'border-primary-500' : ''}
            />
            {formData.confirmPassword && formData.password && formData.password !== formData.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>As senhas não coincidem</span>
              </p>
            )}
            {formData.confirmPassword && formData.password && formData.password === formData.confirmPassword && formData.password.length >= 6 && (
              <p className="mt-1 text-xs text-primary-600 flex items-center space-x-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>As senhas coincidem</span>
              </p>
            )}
            {formData.password && formData.password.length > 0 && formData.password.length < 6 && (
              <p className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>A senha deve ter pelo menos 6 caracteres</span>
              </p>
            )}
          </div>

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

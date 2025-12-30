'use client'

import { X, Check, LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  resourceTitle?: string
  resourcePreview?: React.ReactNode
  resourceType?: 'audio' | 'image' | 'video' | 'font' | 'psd' | 'ai'
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  resourceTitle,
  resourcePreview,
  resourceType = 'audio'
}: SubscriptionModalProps) {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
    }
    checkAuth()
  }, [supabase])

  if (!isOpen) return null

  const benefits = [
    'Downloads ilimitados de recursos premium',
    'Acesso completo à biblioteca de áudios, imagens, vídeos e fontes',
    'Licença comercial para todos os recursos',
    'Suporte prioritário',
    'Cancelamento fácil a qualquer momento'
  ]

  const handleSubscribe = () => {
    onClose()
    router.push('/premium')
  }

  const handleLogin = () => {
    onClose()
    router.push('/login')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Quer este item?
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Resource Preview */}
          {resourcePreview && (
            <div className="mb-6 rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
              {resourcePreview}
            </div>
          )}

          {/* Resource Title */}
          {resourceTitle && (
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {resourceTitle}
            </h3>
          )}

          {/* Subscription Offer */}
          <p className="text-gray-700 mb-6 leading-relaxed">
            Faça download deste e de todos os recursos criativos que você precisa com uma assinatura premium.
          </p>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Check className="h-5 w-5 text-primary-500" />
                </div>
                <p className="text-gray-700 text-sm">{benefit}</p>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            {isLoggedIn ? (
              // Se estiver logado, mostrar apenas botão de assinatura
              <button
                onClick={handleSubscribe}
                className={cn(
                  "w-full py-4 px-6 rounded-xl font-semibold text-white transition-all",
                  "bg-primary-500 hover:bg-primary-600 shadow-lg hover:shadow-xl",
                  "transform hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                Assinar para fazer o download
              </button>
            ) : (
              // Se não estiver logado, mostrar opções de inscrever e login
              <>
                <button
                  onClick={handleSubscribe}
                  className={cn(
                    "w-full py-4 px-6 rounded-xl font-semibold text-white transition-all",
                    "bg-primary-500 hover:bg-primary-600 shadow-lg hover:shadow-xl",
                    "transform hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  Inscreva-se para fazer o download
                </button>
                <button
                  onClick={handleLogin}
                  className="w-full py-3 px-6 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Já tem uma conta? Inicie a sessão
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


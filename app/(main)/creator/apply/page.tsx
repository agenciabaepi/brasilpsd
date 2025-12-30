'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { Share2, DollarSign, CheckCircle, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function CreatorApplyPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    portfolio_url: '',
    is_contributor_on_other_platform: false,
    other_platform_name: '',
    accepted_guidelines: false
  })
  const [hasApplication, setHasApplication] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)

  useEffect(() => {
    checkUserAndApplication()
  }, [])

  async function checkUserAndApplication() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/creator/apply')
        return
      }

      // Verificar se já é criador
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_creator')
        .eq('id', user.id)
        .single()

      if (profile?.is_creator) {
        toast.success('Você já é um criador!')
        router.push('/creator')
        return
      }

      // Verificar se já tem uma solicitação
      const { data: application } = await supabase
        .from('creator_applications')
        .select('status')
        .eq('user_id', user.id)
        .single()

      if (application) {
        setHasApplication(true)
        setApplicationStatus(application.status)
      }
    } catch (error: any) {
      if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erro ao verificar aplicação:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.accepted_guidelines) {
      toast.error('Você precisa aceitar as diretrizes de parceiro')
      return
    }

    if (!formData.portfolio_url.trim()) {
      toast.error('Por favor, informe o link do seu portfólio')
      return
    }

    // Validar URL
    try {
      new URL(formData.portfolio_url)
    } catch {
      toast.error('Por favor, informe uma URL válida')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/creator/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolio_url: formData.portfolio_url.trim(),
          is_contributor_on_other_platform: formData.is_contributor_on_other_platform,
          other_platform_name: formData.is_contributor_on_other_platform 
            ? formData.other_platform_name.trim() 
            : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação')
      }

      toast.success('Solicitação enviada com sucesso! Aguarde a análise da nossa equipe.')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Erro ao enviar solicitação:', error)
      toast.error(error.message || 'Erro ao enviar solicitação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (hasApplication) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card className="p-8 text-center">
          <div className="mb-6">
            {applicationStatus === 'pending' && (
              <>
                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-yellow-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Solicitação em Análise
                </h1>
                <p className="text-gray-600">
                  Sua solicitação para se tornar um criador está sendo analisada pela nossa equipe.
                  Você será notificado assim que houver uma resposta.
                </p>
              </>
            )}
            {applicationStatus === 'approved' && (
              <>
                <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-primary-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Solicitação Aprovada!
                </h1>
                <p className="text-gray-600 mb-4">
                  Parabéns! Você já é um criador. Acesse seu painel para começar a compartilhar seus trabalhos.
                </p>
                <Link href="/creator">
                  <Button variant="primary">
                    Acessar Painel de Criador
                  </Button>
                </Link>
              </>
            )}
            {applicationStatus === 'rejected' && (
              <>
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Solicitação Rejeitada
                </h1>
                <p className="text-gray-600">
                  Infelizmente sua solicitação não foi aprovada. Entre em contato conosco para mais informações.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Benefits Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Share2 className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Compartilhe seus trabalhos</h3>
            <p className="text-sm text-gray-600">
              Exponha suas criações para uma comunidade de designers
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Seja remunerado</h3>
            <p className="text-sm text-gray-600">
              Ganhe com cada download nos seus arquivos
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Seja verificado</h3>
            <p className="text-sm text-gray-600">
              Obtenha um selo de parceiro verificado em sua conta
            </p>
          </Card>
        </div>

        {/* Application Form */}
        <Card className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Inscrição para Parceiro BrasilPSD
            </h1>
            <p className="text-gray-600">
              Compartilhe seu trabalho com milhares de designers
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Portfolio URL */}
            <div>
              <label htmlFor="portfolio_url" className="block text-sm font-medium text-gray-700 mb-2">
                Link do portfólio *
              </label>
              <Input
                id="portfolio_url"
                type="url"
                value={formData.portfolio_url}
                onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                placeholder="https://behance.net/seuportfolio"
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                Pode ser Behance, Dribbble, site pessoal ou outro portfólio online
              </p>
            </div>

            {/* Contributor on other platform */}
            <div>
              <label htmlFor="is_contributor" className="block text-sm font-medium text-gray-700 mb-2">
                Já é contribuidor em outra plataforma?
              </label>
              <select
                id="is_contributor"
                value={formData.is_contributor_on_other_platform ? 'yes' : 'no'}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  is_contributor_on_other_platform: e.target.value === 'yes',
                  other_platform_name: e.target.value === 'no' ? '' : formData.other_platform_name
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="no">Não</option>
                <option value="yes">Sim</option>
              </select>
            </div>

            {/* Other platform name */}
            {formData.is_contributor_on_other_platform && (
              <div>
                <label htmlFor="other_platform_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da plataforma
                </label>
                <Input
                  id="other_platform_name"
                  type="text"
                  value={formData.other_platform_name}
                  onChange={(e) => setFormData({ ...formData, other_platform_name: e.target.value })}
                  placeholder="Ex: Envato, Creative Market, etc."
                />
              </div>
            )}

            {/* Guidelines checkbox */}
            <div className="flex items-start">
              <input
                id="accepted_guidelines"
                type="checkbox"
                checked={formData.accepted_guidelines}
                onChange={(e) => setFormData({ ...formData, accepted_guidelines: e.target.checked })}
                className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="accepted_guidelines" className="ml-3 text-sm text-gray-700">
                Aceito as{' '}
                <Link href="/guidelines" className="text-purple-600 hover:text-purple-700 underline" target="_blank">
                  diretrizes de parceiro
                </Link>
                .
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={submitting}
              disabled={submitting}
            >
              Enviar inscrição
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}



'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Zap, Star, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function PremiumPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [user, setUser] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadUserData()
  }, [])

  async function loadUserData() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const [profileResult, subscriptionResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single(),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      setUser(profileResult.data)
      setSubscription(subscriptionResult.data)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePlan(newTier: string) {
    if (!subscription) {
      // Se não tem assinatura, apenas redirecionar para checkout
      router.push(`/checkout/${newTier}?cycle=${billingCycle}`)
      return
    }

    if (subscription.tier === newTier) {
      toast.error('Você já possui este plano ativo')
      return
    }

    if (!confirm(`Tem certeza que deseja trocar de ${subscription.tier.toUpperCase()} para ${newTier.toUpperCase()}?\n\nSua assinatura atual será cancelada e você precisará realizar um novo pagamento.`)) {
      return
    }

    setChangingPlan(newTier)
    try {
      const res = await fetch('/api/finance/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTier, billingCycle })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao trocar plano')
      }

      toast.success('Plano alterado! Realize o pagamento para ativar.')
      
      // Redirecionar para checkout com o novo plano
      router.push(`/checkout/${newTier}?cycle=${billingCycle}`)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao trocar plano')
    } finally {
      setChangingPlan(null)
    }
  }

  const plans = [
    {
      id: 'lite',
      name: 'Premium Lite',
      price: '5,00', // Valor mínimo do Asaas para testes
      description: 'Até 5 downloads por dia',
      icon: Zap,
      color: 'secondary',
      features: ['Acesso total', 'Arquivos PSD/AI', 'Suporte via Chat']
    },
    {
      id: 'pro',
      name: 'Premium Pro',
      price: '5,00', // Valor mínimo do Asaas para testes
      description: 'Até 10 downloads por dia',
      icon: Crown,
      color: 'primary',
      popular: true,
      features: ['Acesso total', 'Velocidade máxima', 'Sem anúncios']
    },
    {
      id: 'plus',
      name: 'Premium Plus',
      price: '5,00', // Valor mínimo do Asaas para testes
      description: 'Até 20 downloads por dia',
      icon: Star,
      color: 'secondary',
      features: ['Acesso total', 'Suporte Prioritário', 'Atualizações diárias']
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50/50 min-h-screen py-20 px-4">
      <div className="container mx-auto max-w-7xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-6">
          {subscription ? 'Gerenciar seu plano' : 'Escolha seu plano'} <span className="text-primary-500">Premium</span>
        </h1>
        
        {subscription && (
          <div className="mb-8 inline-block bg-white rounded-2xl px-6 py-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Plano Atual</p>
            <p className="text-lg font-bold text-gray-900">
              Premium {subscription.tier.toUpperCase()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Válido até {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
            </p>
          </div>
        )}
        
        {/* Seletor de Ciclo */}
        <div className="flex items-center justify-center space-x-4 mb-16">
          <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex items-center">
            <button onClick={() => setBillingCycle('monthly')} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", billingCycle === 'monthly' ? "bg-gray-900 text-white" : "text-gray-400")}>Mensal</button>
            <button onClick={() => setBillingCycle('yearly')} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", billingCycle === 'yearly' ? "bg-gray-900 text-white" : "text-gray-400")}>Anual</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan.id} className={cn("bg-white rounded-[2.5rem] border border-gray-100 p-10 flex flex-col transition-all hover:shadow-xl", plan.popular && "ring-2 ring-primary-500 ring-offset-4")}>
              <div className="space-y-8 flex-1">
                <div className="space-y-4 text-left">
                  <plan.icon className={cn("h-10 w-10", plan.color === 'primary' ? "text-primary-500" : "text-secondary-600")} />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{plan.name}</h3>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-semibold text-gray-900">R$</span>
                    <span className="text-5xl font-semibold text-gray-900 tracking-tighter">{plan.price}</span>
                    <span className="text-gray-400 text-sm font-semibold">/mês</span>
                  </div>
                </div>
                <div className="space-y-4 text-left">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center space-x-3 text-sm font-medium text-gray-600"><Check className="h-4 w-4 text-primary-500" /><span>{f}</span></div>
                  ))}
                </div>
              </div>
              <div className="mt-10">
                {subscription && subscription.tier === plan.id ? (
                  <button 
                    disabled
                    className="w-full h-14 rounded-2xl font-semibold text-xs uppercase tracking-widest bg-gray-200 text-gray-500 cursor-not-allowed"
                  >
                    Plano Atual
                  </button>
                ) : (
                  <button
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={changingPlan === plan.id}
                    className={cn(
                      "w-full h-14 rounded-2xl font-semibold text-xs uppercase tracking-widest transition-all disabled:opacity-50",
                      plan.color === 'primary' ? "bg-primary-600 hover:bg-primary-700 text-white" : "bg-secondary-600 hover:bg-secondary-700 text-white"
                    )}
                  >
                    {changingPlan === plan.id ? (
                      <span className="flex items-center justify-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Trocando...</span>
                      </span>
                    ) : subscription ? (
                      'Trocar para este plano'
                    ) : (
                      'Assinar Agora'
                    )}
                </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

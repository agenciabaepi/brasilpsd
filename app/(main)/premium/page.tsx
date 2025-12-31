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

  // Preços dos planos (valor anual = mensal * 12 com 15% de desconto)
  const monthlyPrices = { lite: 19.90, pro: 29.90, plus: 49.90 }
  const calculateYearlyPrice = (monthly: number) => {
    const yearlyTotal = monthly * 12
    return Math.round(yearlyTotal * 0.85 * 100) / 100 // 15% desconto, arredondado
  }

  const planPrices = {
    lite: { monthly: monthlyPrices.lite, yearly: calculateYearlyPrice(monthlyPrices.lite) },
    pro: { monthly: monthlyPrices.pro, yearly: calculateYearlyPrice(monthlyPrices.pro) },
    plus: { monthly: monthlyPrices.plus, yearly: calculateYearlyPrice(monthlyPrices.plus) }
  }

  const plans = [
    {
      id: 'lite',
      name: 'Premium Lite',
      monthlyPrice: planPrices.lite.monthly,
      yearlyPrice: planPrices.lite.yearly,
      description: 'Ideal para iniciantes',
      icon: Zap,
      color: 'secondary',
      downloadLimit: 3,
      features: [
        '3 downloads por dia',
        'Acesso total à biblioteca',
        'Arquivos PSD, AI e vetores',
        'Suporte via Chat',
        'Sem anúncios',
        'Downloads ilimitados de recursos gratuitos'
      ]
    },
    {
      id: 'pro',
      name: 'Premium Pro',
      monthlyPrice: planPrices.pro.monthly,
      yearlyPrice: planPrices.pro.yearly,
      description: 'Para profissionais criativos',
      icon: Crown,
      color: 'primary',
      popular: true,
      downloadLimit: 10,
      features: [
        '10 downloads por dia',
        'Acesso total à biblioteca',
        'Arquivos PSD, AI e vetores',
        'Velocidade máxima de download',
        'Sem anúncios',
        'Suporte prioritário',
        'Acesso antecipado a novos recursos'
      ]
    },
    {
      id: 'plus',
      name: 'Premium Plus',
      monthlyPrice: planPrices.plus.monthly,
      yearlyPrice: planPrices.plus.yearly,
      description: 'Máximo desempenho',
      icon: Star,
      color: 'secondary',
      downloadLimit: 20,
      features: [
        '20 downloads por dia',
        'Acesso total à biblioteca',
        'Arquivos PSD, AI e vetores',
        'Velocidade máxima de download',
        'Sem anúncios',
        'Suporte prioritário 24/7',
        'Acesso antecipado a novos recursos',
        'Atualizações diárias da biblioteca'
      ]
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
                  <div className="space-y-2">
                    {billingCycle === 'yearly' && (
                      <div className="flex items-center space-x-2 animate-bounce-in">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold shadow-lg animate-pulse hover:animate-none transition-all transform hover:scale-110">
                          <span className="relative flex h-2 w-2 mr-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </span>
                          15% OFF
                        </span>
                        <span className="text-xs text-gray-400 line-through animate-fade-in">
                          R$ {(plan.monthlyPrice * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-semibold text-gray-900">R$</span>
                      <span className="text-5xl font-semibold text-gray-900 tracking-tighter">
                        {(billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-gray-400 text-sm font-semibold">/mês</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-xs text-gray-500 font-medium">
                        Total anual: R$ {plan.yearlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-4 text-left">
                  <div className="pb-4 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Downloads Diários</p>
                    <p className="text-2xl font-bold text-gray-900">{plan.downloadLimit} <span className="text-sm font-normal text-gray-500">por dia</span></p>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                  <div className="space-y-3">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-start space-x-3 text-sm font-medium text-gray-600">
                        <Check className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
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

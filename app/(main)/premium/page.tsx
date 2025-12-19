'use client'

import { useState } from 'react'
import { Check, Crown, Zap, Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

export default function PremiumPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  const plans = [
    {
      id: 'lite',
      name: 'Premium Lite',
      price: billingCycle === 'monthly' ? '19,90' : '16,90',
      description: 'Até 5 downloads por dia',
      icon: Zap,
      color: 'blue',
      features: ['Acesso total', 'Arquivos PSD/AI', 'Suporte via Chat']
    },
    {
      id: 'pro',
      name: 'Premium Pro',
      price: billingCycle === 'monthly' ? '29,90' : '24,90',
      description: 'Até 10 downloads por dia',
      icon: Crown,
      color: 'orange',
      popular: true,
      features: ['Acesso total', 'Velocidade máxima', 'Sem anúncios']
    },
    {
      id: 'plus',
      name: 'Premium Plus',
      price: billingCycle === 'monthly' ? '49,90' : '39,90',
      description: 'Até 20 downloads por dia',
      icon: Star,
      color: 'purple',
      features: ['Acesso total', 'Suporte Prioritário', 'Atualizações diárias']
    }
  ]

  return (
    <div className="bg-gray-50/50 min-h-screen py-20 px-4">
      <div className="container mx-auto max-w-7xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-6">
          Escolha seu plano <span className="text-primary-500">Premium</span>
        </h1>
        
        {/* Seletor de Ciclo */}
        <div className="flex items-center justify-center space-x-4 mb-16">
          <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex items-center">
            <button onClick={() => setBillingCycle('monthly')} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", billingCycle === 'monthly' ? "bg-gray-900 text-white" : "text-gray-400")}>Mensal</button>
            <button onClick={() => setBillingCycle('yearly')} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", billingCycle === 'yearly' ? "bg-gray-900 text-white" : "text-gray-400")}>Anual</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan.id} className={cn("bg-white rounded-[2.5rem] border border-gray-100 p-10 flex flex-col transition-all hover:shadow-xl", plan.popular && "ring-2 ring-orange-500 ring-offset-4")}>
              <div className="space-y-8 flex-1">
                <div className="space-y-4 text-left">
                  <plan.icon className={cn("h-10 w-10", plan.color === 'blue' ? "text-blue-500" : plan.color === 'orange' ? "text-orange-500" : "text-purple-500")} />
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{plan.name}</h3>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-gray-900">R$</span>
                    <span className="text-5xl font-black text-gray-900 tracking-tighter">{plan.price}</span>
                    <span className="text-gray-400 text-sm font-semibold">/mês</span>
                  </div>
                </div>
                <div className="space-y-4 text-left">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center space-x-3 text-sm font-medium text-gray-600"><Check className="h-4 w-4 text-primary-500" /><span>{f}</span></div>
                  ))}
                </div>
              </div>
              <Link href={`/checkout/${plan.id}?cycle=${billingCycle}`} className="mt-10">
                <button className={cn("w-full h-14 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all", plan.popular ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")}>
                  Assinar Agora
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

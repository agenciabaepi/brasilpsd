'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CreditCard, QrCode, Barcode, Check, X, Copy, ShieldCheck, ArrowLeft, Lock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Method = 'CREDIT_CARD' | 'PIX' | 'BOLETO'

export default function CheckoutPage() {
  const { tier } = useParams()
  const searchParams = useSearchParams()
  const cycle = searchParams.get('cycle') || 'monthly'
  
  const [method, setMethod] = useState<Method>('CREDIT_CARD')
  const [loading, setLoading] = useState(false)
  const [paymentResult, setPaymentResult] = useState<any>(null)

  const [card, setCard] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: ''
  })

  const planInfo: any = {
    lite: { name: 'Premium Lite', price: cycle === 'monthly' ? 19.90 : 16.90 },
    pro: { name: 'Premium Pro', price: cycle === 'monthly' ? 29.90 : 24.90 },
    plus: { name: 'Premium Plus', price: cycle === 'monthly' ? 49.90 : 39.90 },
  }

  const currentPlan = planInfo[tier as string] || planInfo.pro

  async function handlePayment() {
    setLoading(true)
    try {
      const body: any = { tier, method, billingCycle: cycle }
      if (method === 'CREDIT_CARD') {
        body.creditCard = {
          holderName: card.holderName,
          number: card.number.replace(/\s/g, ''),
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ccv: card.ccv
        }
        body.creditCardHolderInfo = {
          name: card.holderName,
          email: 'auto',
          cpfCnpj: '00000000000', // Campo necessário no futuro
          postalCode: '00000000',
          addressNumber: '0',
          phone: '0000000000'
        }
      }

      const res = await fetch('/api/finance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (method === 'CREDIT_CARD') {
        toast.success('Assinatura ativada com sucesso!')
        window.location.href = '/dashboard'
      } else {
        setPaymentResult(data)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        <Link href="/premium" className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Planos
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Coluna de Pagamento */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
              <h1 className="text-2xl font-bold text-gray-900 mb-8">Como deseja pagar?</h1>
              
              <div className="grid grid-cols-3 gap-3 mb-10">
                <MethodBtn active={method === 'CREDIT_CARD'} onClick={() => setMethod('CREDIT_CARD')} icon={CreditCard} label="Cartão" />
                <MethodBtn active={method === 'PIX'} onClick={() => setMethod('PIX')} icon={QrCode} label="PIX" />
                <MethodBtn active={method === 'BOLETO'} onClick={() => setMethod('BOLETO')} icon={Barcode} label="Boleto" />
              </div>

              {method === 'CREDIT_CARD' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome no Cartão</label>
                    <input type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 text-sm focus:ring-2 focus:ring-primary-500/10 outline-none mt-1" placeholder="JOÃO SILVA" value={card.holderName} onChange={e => setCard({...card, holderName: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Número do Cartão</label>
                    <input type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 text-sm focus:ring-2 focus:ring-primary-500/10 outline-none mt-1" placeholder="0000 0000 0000 0000" value={card.number} onChange={e => setCard({...card, number: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mês (MM)</label>
                      <input type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 text-sm outline-none mt-1" placeholder="12" value={card.expiryMonth} onChange={e => setCard({...card, expiryMonth: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ano (AA)</label>
                      <input type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 text-sm outline-none mt-1" placeholder="2029" value={card.expiryYear} onChange={e => setCard({...card, expiryYear: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CVC</label>
                      <input type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 text-sm outline-none mt-1" placeholder="123" value={card.ccv} onChange={e => setCard({...card, ccv: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {method === 'PIX' && (
                <div className="bg-primary-50/50 p-6 rounded-3xl border border-primary-100 text-center space-y-2">
                  <p className="text-sm font-bold text-primary-700">Aprovação Imediata</p>
                  <p className="text-xs text-primary-600 font-medium">O QR Code será gerado após você clicar em "Finalizar Assinatura".</p>
                </div>
              )}

              {method === 'BOLETO' && (
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 text-center space-y-2">
                  <p className="text-sm font-bold text-blue-700">Até 3 dias úteis para aprovar</p>
                  <p className="text-xs text-blue-600 font-medium">O boleto será gerado após você clicar em "Finalizar Assinatura".</p>
                </div>
              )}

              <button onClick={handlePayment} disabled={loading} className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all mt-10 disabled:opacity-50">
                {loading ? 'Processando...' : 'Finalizar Assinatura'}
              </button>
            </div>

            <div className="flex items-center justify-center space-x-6 text-gray-400">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">SSL Seguro</span>
              </div>
              <div className="flex items-center space-x-2">
                <Lock className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Dados Criptografados</span>
              </div>
            </div>
          </div>

          {/* Coluna de Resumo */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm sticky top-8">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Resumo da Compra</h2>
              
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{currentPlan.name}</h3>
                  <p className="text-xs font-semibold text-gray-400 uppercase mt-1">Plano {cycle === 'monthly' ? 'Mensal' : 'Anual'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900">R$ {currentPlan.price.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>

              <div className="space-y-4 py-6 border-y border-gray-50 mb-8">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-500">Subtotal</span>
                  <span className="font-bold text-gray-900">R$ {currentPlan.price.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span className="font-semibold">Taxas</span>
                  <span className="font-bold">R$ 0,00</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-black text-primary-500">R$ {currentPlan.price.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL DE PAGAMENTO (PIX/BOLETO) */}
        {paymentResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative text-center space-y-6 animate-in zoom-in fade-in duration-300">
              <button onClick={() => setPaymentResult(null)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
              
              <div className="h-16 w-16 bg-primary-50 text-primary-500 rounded-3xl flex items-center justify-center mx-auto">
                {method === 'PIX' ? <QrCode className="h-8 w-8" /> : <Barcode className="h-8 w-8" />}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Assinatura Gerada!</h3>
              
              {method === 'PIX' ? (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 inline-block mx-auto">
                    <img src={`data:image/png;base64,${paymentResult.qrCode}`} alt="QR Code" className="w-48 h-48" />
                  </div>
                  <button onClick={() => {navigator.clipboard.writeText(paymentResult.copyPaste); toast.success('Copiado!')}} className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-2">
                    <Copy className="h-4 w-4" /><span>Copiar Código PIX</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-500 text-sm font-medium">Seu boleto foi gerado. Clique abaixo para ver o boleto e pagar.</p>
                  <a href={paymentResult.bankSlipUrl} target="_blank" className="block w-full h-14 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center">Visualizar Boleto</a>
                </div>
              )}
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">O acesso será liberado assim que o pagamento for confirmado.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MethodBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center space-y-2 py-6 rounded-3xl border-2 transition-all", active ? "bg-primary-50 border-primary-500 text-primary-600" : "bg-white border-gray-50 text-gray-400 hover:border-gray-200")}>
      <Icon className="h-6 w-6" />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  )
}


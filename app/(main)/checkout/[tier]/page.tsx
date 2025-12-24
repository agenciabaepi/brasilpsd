'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { CreditCard, QrCode, Barcode, Check, X, Copy, ShieldCheck, ArrowLeft, Lock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Method = 'CREDIT_CARD' | 'PIX' | 'BOLETO'

export default function CheckoutPage() {
  const { tier } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const cycle = searchParams.get('cycle') || 'monthly'
  
  const [method, setMethod] = useState<Method>('CREDIT_CARD')
  const [loading, setLoading] = useState(false)
  const [paymentResult, setPaymentResult] = useState<any>(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [card, setCard] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: ''
  })

  const planInfo: any = {
    lite: { name: 'Premium Lite', price: 5.00 },
    pro: { name: 'Premium Pro', price: 5.00 },
    plus: { name: 'Premium Plus', price: 5.00 },
  }

  const currentPlan = planInfo[tier as string] || planInfo.pro

  // Função para iniciar polling automático do pagamento
  function startPaymentPolling(paymentId: string) {
    // Limpar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Verificar a cada 3 segundos
    let attempts = 0
    const maxAttempts = 200 // Máximo de 10 minutos (200 * 3s)
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++
      
      // Limitar tentativas para evitar polling infinito
      if (attempts > maxAttempts) {
        console.warn('⏱️ Polling atingiu limite de tentativas')
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        return
      }

      try {
        console.log(`🔍 Verificando pagamento ${paymentId} (tentativa ${attempts})...`)
        
        const res = await fetch('/api/finance/check-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId })
        })
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.warn(`⚠️ Erro na verificação (${res.status}):`, errorData.error || 'Erro desconhecido')
          return
        }
        
        const data = await res.json()
        
        console.log(`📊 Status do pagamento:`, {
          success: data.success,
          premiumActivated: data.premiumActivated,
          status: data.payment?.status,
          message: data.message
        })
        
        // Verificar se o pagamento foi confirmado/recebido
        const isPaymentConfirmed = data.payment?.status === 'CONFIRMED' || data.payment?.status === 'RECEIVED'
        
        if (data.success && (data.premiumActivated || isPaymentConfirmed)) {
          console.log('✅ Pagamento confirmado! Parando polling e ativando confete...')
          
          // Parar o polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          
          // Marcar como confirmado e mostrar confete
          setPaymentConfirmed(true)
          
          // Aguardar um pouco para mostrar o confete, depois redirecionar
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else if (isPaymentConfirmed && !data.premiumActivated) {
          // Se o pagamento está confirmado mas premiumActivated não foi true, tentar novamente
          console.log('⚠️ Pagamento confirmado mas premiumActivated não foi true, tentando novamente...')
        }
      } catch (error: any) {
        console.error('❌ Erro ao verificar pagamento:', error.message || error)
        // Não parar o polling por causa de erros de rede, continuar tentando
      }
    }, 3000) // Verificar a cada 3 segundos
  }

  // Limpar polling quando o componente desmontar ou quando o modal fechar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Limpar polling quando fechar o modal
  useEffect(() => {
    if (!paymentResult && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [paymentResult])

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
        // Iniciar verificação automática do pagamento
        // O ID do pagamento pode vir em paymentId ou id
        const paymentId = data.paymentId || data.id
        if (paymentId) {
          console.log('🔄 Iniciando polling para pagamento:', paymentId)
          startPaymentPolling(paymentId)
        } else {
          console.error('❌ ID do pagamento não encontrado na resposta:', data)
          toast.error('Erro: ID do pagamento não encontrado')
        }
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
              {!paymentConfirmed && (
              <button onClick={() => setPaymentResult(null)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
              )}
              
              {paymentConfirmed ? (
                <>
                  {/* Efeito de Confete */}
                  <Confetti />
                  
                  <div className="h-16 w-16 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto animate-bounce">
                    <Check className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Pagamento Confirmado!</h3>
                  <p className="text-gray-600 font-medium">Redirecionando para o dashboard...</p>
                </>
              ) : (
                <>
              <div className="h-16 w-16 bg-primary-50 text-primary-500 rounded-3xl flex items-center justify-center mx-auto">
                {method === 'PIX' ? <QrCode className="h-8 w-8" /> : <Barcode className="h-8 w-8" />}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Assinatura Gerada!</h3>
              
              {method === 'PIX' ? (
                <div className="space-y-6">
                  {paymentResult.qrCode ? (
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 inline-block mx-auto">
                      <img 
                        src={paymentResult.qrCode.startsWith('data:') ? paymentResult.qrCode : `data:image/png;base64,${paymentResult.qrCode}`} 
                        alt="QR Code PIX" 
                        className="w-48 h-48"
                        onError={(e) => {
                          console.error('Erro ao carregar QR Code:', e)
                          toast.error('Erro ao exibir QR Code. Use o código copiável abaixo.')
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center">
                      <p className="text-sm text-gray-500">QR Code não disponível</p>
                    </div>
                  )}
                  {paymentResult.copyPaste && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(paymentResult.copyPaste)
                        toast.success('Código PIX copiado!')
                      }} 
                      className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Copiar Código PIX</span>
                    </button>
                  )}
                  {paymentResult.copyPaste && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Código PIX (copie e cole no app do banco):</p>
                      <p className="text-xs font-mono text-gray-700 break-all">{paymentResult.copyPaste}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                    <span className="font-medium">Aguardando confirmação do pagamento...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-500 text-sm font-medium">Seu boleto foi gerado. Clique abaixo para ver o boleto e pagar.</p>
                  <a href={paymentResult.bankSlipUrl} target="_blank" className="block w-full h-14 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center">Visualizar Boleto</a>
                      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                        <span className="font-medium">Aguardando confirmação do pagamento...</span>
                      </div>
                </div>
              )}
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">O acesso será liberado assim que o pagamento for confirmado.</p>
                </>
              )}
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

// Componente de Confete
function Confetti() {
  useEffect(() => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE']
    const confettiCount = 150
    
    const confettiElements: HTMLElement[] = []
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div')
      const color = colors[Math.floor(Math.random() * colors.length)]
      const size = Math.random() * 10 + 5
      const startX = Math.random() * window.innerWidth
      const startY = -10
      const endY = window.innerHeight + 10
      const rotation = Math.random() * 360
      const duration = Math.random() * 2 + 2
      const delay = Math.random() * 0.5
      
      confetti.style.position = 'fixed'
      confetti.style.left = `${startX}px`
      confetti.style.top = `${startY}px`
      confetti.style.width = `${size}px`
      confetti.style.height = `${size}px`
      confetti.style.backgroundColor = color
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
      confetti.style.pointerEvents = 'none'
      confetti.style.zIndex = '9999'
      confetti.style.opacity = '0.9'
      
      document.body.appendChild(confetti)
      confettiElements.push(confetti)
      
      // Animar o confete
      requestAnimationFrame(() => {
        confetti.style.transition = `all ${duration}s ease-out ${delay}s`
        confetti.style.transform = `translateY(${endY}px) rotate(${rotation + 360}deg)`
        confetti.style.opacity = '0'
      })
    }
    
    // Remover confetes após a animação
    setTimeout(() => {
      confettiElements.forEach(confetti => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti)
        }
      })
    }, 5000)
    
    return () => {
      confettiElements.forEach(confetti => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti)
        }
      })
    }
  }, [])
  
  return null
}


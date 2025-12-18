export const asaas = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const apiKey = process.env.ASAAS_API_KEY;
    const apiUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

    if (!apiKey) {
      console.error('❌ ERRO: ASAAS_API_KEY não encontrada nas variáveis de ambiente!');
      throw new Error('Configuração de pagamento incompleta (API Key faltando)');
    }

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        // Se o erro vier do Asaas, repassamos a mensagem deles
        const errorMsg = data.errors?.[0]?.description || data.message || `Erro na API do Asaas (${response.status})`
        console.error(`Erro Asaas API [${response.status}]:`, errorMsg, data)
        throw new Error(errorMsg)
      }
      return data
    } catch (error: any) {
      // Se for um erro de rede ou JSON parsing, relançar com mensagem mais clara
      if (error.message && !error.message.includes('API do Asaas') && !error.message.includes('Configuração')) {
        throw new Error(`Erro ao conectar com Asaas: ${error.message}`)
      }
      throw error
    }
  },

  async getOrCreateCustomer(user: { email: string; full_name: string; id: string }) {
    try {
      const customers = await this.fetch(`/customers?email=${user.email}`)
      if (customers.data && customers.data.length > 0) return customers.data[0].id

      const newCustomer = await this.fetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: user.full_name,
          email: user.email,
          externalReference: user.id
        })
      })
      return newCustomer.id
    } catch (error: any) {
      console.error('Erro ao buscar/criar cliente no Asaas:', error.message);
      throw error;
    }
  },

  async createSubscription({ customerId, amount, tier, billingType, cycle, creditCard, creditCardHolderInfo }: any) {
    const body: any = {
      customer: customerId,
      billingType: billingType,
      value: amount,
      nextDueDate: new Date().toISOString().split('T')[0],
      cycle: cycle || 'MONTHLY',
      description: `Assinatura BrasilPSD - Plano ${tier.toUpperCase()}`,
      externalReference: tier,
    }

    if (billingType === 'CREDIT_CARD') {
      body.creditCard = creditCard
      body.creditCardHolderInfo = creditCardHolderInfo
    }

    const subscription = await this.fetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    if (billingType === 'PIX' || billingType === 'BOLETO') {
      const payments = await this.fetch(`/payments?subscription=${subscription.id}`)
      const firstPayment = payments.data[0]

      if (billingType === 'PIX') {
        const qrCode = await this.fetch(`/payments/${firstPayment.id}/pixQrCode`)
        return { 
          subscriptionId: subscription.id,
          paymentId: firstPayment.id,
          qrCode: qrCode.encodedImage,
          copyPaste: qrCode.payload,
          invoiceUrl: firstPayment.invoiceUrl 
        }
      }

      return { 
        subscriptionId: subscription.id,
        paymentId: firstPayment.id,
        bankSlipUrl: firstPayment.bankSlipUrl,
        invoiceUrl: firstPayment.invoiceUrl 
      }
    }

    return subscription
  },

  // Buscar todas as assinaturas
  async getSubscriptions(filters?: { status?: string; customer?: string }) {
    let endpoint = '/subscriptions'
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.customer) params.append('customer', filters.customer)
    if (params.toString()) endpoint += `?${params.toString()}`
    return this.fetch(endpoint)
  },

  // Buscar assinatura específica
  async getSubscription(subscriptionId: string) {
    return this.fetch(`/subscriptions/${subscriptionId}`)
  },

  // Cancelar assinatura
  async cancelSubscription(subscriptionId: string) {
    return this.fetch(`/subscriptions/${subscriptionId}`, {
      method: 'DELETE'
    })
  },

  // Reativar assinatura
  async reactivateSubscription(subscriptionId: string) {
    return this.fetch(`/subscriptions/${subscriptionId}`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  },

  // Alterar plano de assinatura
  async updateSubscription(subscriptionId: string, updates: { value?: number; cycle?: string; description?: string }) {
    return this.fetch(`/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
  },

  // Buscar pagamentos de uma assinatura
  async getSubscriptionPayments(subscriptionId: string) {
    return this.fetch(`/payments?subscription=${subscriptionId}`)
  }
}

export const asaas = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    let apiKey = process.env.ASAAS_API_KEY;
    const apiUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

    if (!apiKey) {
      console.error('❌ ERRO: ASAAS_API_KEY não encontrada nas variáveis de ambiente!');
      throw new Error('Configuração de pagamento incompleta (API Key faltando)');
    }

    // O Asaas requer o prefixo $ na chave API
    // Se não começar com $, adicionar automaticamente
    if (!apiKey.startsWith('$')) {
      apiKey = '$' + apiKey;
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
        let errorMsg = data.errors?.[0]?.description || data.message || `Erro na API do Asaas (${response.status})`
        
        // Melhorar mensagem de erro específica do PIX
        if (errorMsg.includes('Pix não está disponível') || errorMsg.includes('PIX não está disponível')) {
          errorMsg = 'PIX não está disponível no momento. Sua conta Asaas precisa estar aprovada para usar PIX. Por favor, use Boleto ou Cartão de Crédito como alternativa.'
        }
        
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

  async getOrCreateCustomer(user: { email: string; full_name: string; id: string; cpf_cnpj?: string | null }) {
    try {
      // Validar dados obrigatórios
      if (!user.email || !user.full_name) {
        throw new Error('Email e nome são obrigatórios para criar customer no Asaas')
      }

      // Buscar cliente existente por email
      const customers = await this.fetch(`/customers?email=${encodeURIComponent(user.email)}`)
      let customer = customers.data && customers.data.length > 0 ? customers.data[0] : null
      
      // Se cliente existe mas não tem CPF e temos CPF, atualizar
      if (customer && user.cpf_cnpj && !customer.cpfCnpj) {
        try {
          const cpfCnpjClean = user.cpf_cnpj.replace(/\D/g, '')
          if (cpfCnpjClean.length >= 11) {
            await this.fetch(`/customers/${customer.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                cpfCnpj: cpfCnpjClean
              })
            })
          }
        } catch (updateError: any) {
          console.warn('Erro ao atualizar CPF do cliente:', updateError.message)
        }
        
        if (customer.id) {
          return customer.id
        }
      }
      
      // Se cliente existe, retornar ID
      if (customer && customer.id) {
        return customer.id
      }

      // Criar novo cliente
      const customerData: any = {
        name: user.full_name,
        email: user.email,
        externalReference: user.id
      }
      
      // Adicionar CPF/CNPJ se disponível (obrigatório para criar cobranças)
      if (user.cpf_cnpj) {
        const cpfCnpjClean = user.cpf_cnpj.replace(/\D/g, '')
        if (cpfCnpjClean.length >= 11) {
          customerData.cpfCnpj = cpfCnpjClean
        } else {
          throw new Error('CPF/CNPJ inválido. Deve ter pelo menos 11 dígitos.')
        }
      } else {
        throw new Error('CPF/CNPJ é obrigatório para criar customer no Asaas')
      }

      const newCustomer = await this.fetch('/customers', {
        method: 'POST',
        body: JSON.stringify(customerData)
      })
      
      if (!newCustomer || !newCustomer.id) {
        throw new Error('Falha ao criar customer no Asaas: ID não retornado')
      }
      
      return newCustomer.id
    } catch (error: any) {
      console.error('Erro ao buscar/criar cliente no Asaas:', error.message);
      throw new Error(`Erro ao conectar com Asaas: ${error.message}`);
    }
  },

  async createSubscription({ customerId, amount, tier, billingType, cycle, creditCard, creditCardHolderInfo }: any) {
    // PIX e BOLETO não são permitidos para assinaturas no Asaas
    // Apenas cartão de crédito pode ser usado em assinaturas recorrentes
    if (billingType !== 'CREDIT_CARD') {
      throw new Error('Apenas cartão de crédito é permitido para assinaturas recorrentes. Use PIX ou BOLETO para pagamentos únicos.')
    }

    const body: any = {
      customer: customerId,
      billingType: billingType,
      value: amount,
      nextDueDate: new Date().toISOString().split('T')[0],
      cycle: cycle || 'MONTHLY',
      description: `Assinatura BrasilPSD - Plano ${tier.toUpperCase()}`,
      externalReference: tier,
      creditCard: creditCard,
      creditCardHolderInfo: creditCardHolderInfo
    }

    const subscription = await this.fetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(body)
    })

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
  },

  // Criar pagamento único (para PIX e BOLETO, já que não podem ser usados em assinaturas)
  async createPayment({ customerId, amount, billingType, description, dueDate, externalReference }: any) {
    const body: any = {
      customer: customerId,
      billingType: billingType,
      value: amount,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      description: description || 'Pagamento BrasilPSD',
    }

    if (externalReference) {
      body.externalReference = externalReference
    }

    const payment = await this.fetch('/payments', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    // Formatar resposta para manter compatibilidade com o frontend
    if (billingType === 'PIX') {
      try {
        // Aguardar um pouco antes de buscar o QR Code (pode levar alguns segundos para gerar)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const qrCode = await this.fetch(`/payments/${payment.id}/pixQrCode`)
        
        console.log('QR Code response from Asaas:', {
          hasEncodedImage: !!qrCode.encodedImage,
          hasPayload: !!qrCode.payload,
          hasCopyPaste: !!qrCode.copyPaste,
          keys: Object.keys(qrCode),
          paymentId: payment.id,
          paymentStatus: payment.status
        })
        
        // O Asaas retorna encodedImage que pode já incluir o prefixo data:image ou ser apenas base64
        let qrCodeImage = qrCode.encodedImage || qrCode.base64Image || qrCode.qrCode
        
        // Se não começar com data:, adicionar o prefixo
        if (qrCodeImage && !qrCodeImage.startsWith('data:')) {
          qrCodeImage = `data:image/png;base64,${qrCodeImage}`
        }
        
        // Garantir que temos o payload (código copiável) - ESSENCIAL para pagamentos PIX
        const pixPayload = qrCode.payload || qrCode.copyPaste || qrCode.pixCopiaECola || qrCode.pixCopyPaste
        
        if (!pixPayload) {
          console.error('❌ Payload PIX não encontrado na resposta do Asaas. Estrutura completa:', JSON.stringify(qrCode, null, 2))
          // Mesmo sem payload, retornar o QR code se existir, pois o usuário ainda pode tentar escanear
          console.warn('⚠️ Continuando sem payload PIX. QR Code pode não funcionar corretamente.')
        }
        
        if (!qrCodeImage && !pixPayload) {
          throw new Error('QR Code PIX não foi gerado corretamente. Verifique se a conta Asaas tem chave PIX cadastrada.')
        }
        
        return {
          paymentId: payment.id,
          subscriptionId: null, // Não é assinatura
          qrCode: qrCodeImage || null,
          copyPaste: pixPayload || null,
          invoiceUrl: payment.invoiceUrl,
          ...payment
        }
      } catch (error: any) {
        console.error('❌ Erro ao buscar QR Code PIX:', {
          error: error.message,
          paymentId: payment.id,
          stack: error.stack
        })
        
        // Se o erro mencionar que não há chave PIX ou QR Code inválido, dar mensagem mais clara
        if (error.message?.includes('QR126E') || error.message?.includes('QR Code') || error.message?.includes('invalid')) {
          throw new Error('QR Code PIX inválido. Verifique se a conta Asaas tem uma chave PIX cadastrada. Se estiver usando sandbox, certifique-se de que a chave PIX está configurada corretamente.')
        }
        
        throw new Error(`Erro ao gerar QR Code PIX: ${error.message || 'QR Code não disponível'}`)
      }
    }

    if (billingType === 'BOLETO') {
      return {
        paymentId: payment.id,
        subscriptionId: null, // Não é assinatura
        bankSlipUrl: payment.bankSlipUrl,
        invoiceUrl: payment.invoiceUrl,
        ...payment
      }
    }

    return {
      paymentId: payment.id,
      subscriptionId: null,
      ...payment
    }
  },

  // Buscar pagamentos com filtros
  async getPayments(filters?: { 
    status?: string
    customer?: string
    subscription?: string
    paymentDate?: string
    dueDate?: string
    limit?: number
    offset?: number
  }) {
    let endpoint = '/payments'
    const params = new URLSearchParams()
    
    if (filters?.status) params.append('status', filters.status)
    if (filters?.customer) params.append('customer', filters.customer)
    if (filters?.subscription) params.append('subscription', filters.subscription)
    if (filters?.paymentDate) params.append('paymentDate', filters.paymentDate)
    if (filters?.dueDate) params.append('dueDate', filters.dueDate)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())
    
    if (params.toString()) endpoint += `?${params.toString()}`
    
    return this.fetch(endpoint)
  },

  // Buscar pagamento específico
  async getPayment(paymentId: string) {
    return this.fetch(`/payments/${paymentId}`)
  },

  // Buscar clientes
  async getCustomers(filters?: { email?: string; name?: string; limit?: number; offset?: number }) {
    let endpoint = '/customers'
    const params = new URLSearchParams()
    
    if (filters?.email) params.append('email', filters.email)
    if (filters?.name) params.append('name', filters.name)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())
    
    if (params.toString()) endpoint += `?${params.toString()}`
    
    return this.fetch(endpoint)
  }
}

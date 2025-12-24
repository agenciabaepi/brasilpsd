-- Tabela para gerenciar assinaturas próprias do sistema
-- Baseadas em pagamentos do Asaas (PIX, Boleto ou Cartão)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('lite', 'pro', 'plus')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled', 'suspended')),
  
  -- Valores e ciclo
  amount DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  
  -- Datas importantes
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  current_period_end DATE NOT NULL, -- Data de vencimento (30 dias após pagamento)
  canceled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Quando a assinatura expira (se cancelada)
  
  -- Relacionamento com pagamentos
  last_payment_id TEXT, -- ID do último pagamento no Asaas
  asaas_customer_id TEXT, -- ID do cliente no Asaas
  
  -- Metadados
  payment_method TEXT, -- 'PIX', 'BOLETO', 'CREDIT_CARD'
  auto_renew BOOLEAN DEFAULT true, -- Se deve renovar automaticamente
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer_id ON public.subscriptions(asaas_customer_id);

-- Comentários
COMMENT ON TABLE public.subscriptions IS 'Assinaturas próprias do sistema, gerenciadas internamente baseadas em pagamentos do Asaas';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'Data de vencimento da assinatura. Quando esta data passar, o usuário será bloqueado se não houver renovação';
COMMENT ON COLUMN public.subscriptions.auto_renew IS 'Se true, o sistema criará automaticamente uma nova cobrança quando a assinatura vencer';
COMMENT ON COLUMN public.subscriptions.last_payment_id IS 'ID do último pagamento confirmado no Asaas que renovou esta assinatura';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger apenas se não existir
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();


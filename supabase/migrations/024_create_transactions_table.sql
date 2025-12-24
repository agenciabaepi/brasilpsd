-- Criar tabela de transações para armazenar pagamentos de assinaturas
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY, -- ID do pagamento no Asaas
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_tier TEXT NOT NULL,
  amount_brute DECIMAL(10, 2) NOT NULL,
  amount_liquid DECIMAL(10, 2) NOT NULL,
  amount_fees DECIMAL(10, 2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending' ou 'paid'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Usuários podem ver suas próprias transações
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins podem ver todas as transações
CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comentários para documentação
COMMENT ON TABLE public.transactions IS 'Armazena transações de pagamento de assinaturas';
COMMENT ON COLUMN public.transactions.id IS 'ID do pagamento no sistema Asaas';
COMMENT ON COLUMN public.transactions.user_id IS 'ID do usuário que realizou o pagamento';
COMMENT ON COLUMN public.transactions.subscription_tier IS 'Tier da assinatura: lite, pro, ou plus';
COMMENT ON COLUMN public.transactions.amount_brute IS 'Valor bruto da transação';
COMMENT ON COLUMN public.transactions.amount_liquid IS 'Valor líquido após taxas';
COMMENT ON COLUMN public.transactions.amount_fees IS 'Valor das taxas cobradas';
COMMENT ON COLUMN public.transactions.payment_method IS 'Método de pagamento usado';
COMMENT ON COLUMN public.transactions.status IS 'Status da transação: pending ou paid';



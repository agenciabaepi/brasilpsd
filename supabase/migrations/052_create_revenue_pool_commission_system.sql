-- ============================================================================
-- Migration: 052 - Sistema de Revenue Pool e Comissões por Download
-- Descrição: Implementa sistema de Revenue Pool onde cada download gera
--            comissão para o criador baseado em um percentual do pool mensal
-- Data: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA: revenue_pool (Pool de Receita Mensal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.revenue_pool (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  month_year TEXT NOT NULL UNIQUE, -- Formato: 'YYYY-MM' (ex: '2025-01')
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Receita total do mês (assinaturas)
  commission_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30.00, -- % do pool destinado aos criadores
  total_downloads INTEGER NOT NULL DEFAULT 0, -- Total de downloads únicos no mês
  distributed_amount DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Valor já distribuído
  remaining_amount DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Valor restante no pool
  status TEXT DEFAULT 'active' NOT NULL, -- 'active', 'closed', 'distributed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

COMMENT ON TABLE public.revenue_pool IS 
'Tabela que armazena o pool de receita mensal usado para calcular comissões dos criadores';

COMMENT ON COLUMN public.revenue_pool.month_year IS 
'Período do pool no formato YYYY-MM (ex: 2025-01)';

COMMENT ON COLUMN public.revenue_pool.total_revenue IS 
'Receita total do mês proveniente de assinaturas';

COMMENT ON COLUMN public.revenue_pool.commission_percentage IS 
'Percentual do pool destinado aos criadores (padrão: 30%)';

COMMENT ON COLUMN public.revenue_pool.total_downloads IS 
'Total de downloads únicos registrados no mês';

COMMENT ON COLUMN public.revenue_pool.distributed_amount IS 
'Valor total já distribuído em comissões';

COMMENT ON COLUMN public.revenue_pool.remaining_amount IS 
'Valor restante disponível no pool';

-- ============================================================================
-- 2. ATUALIZAR TABELA: creator_earnings (adicionar campos necessários)
-- ============================================================================

-- Adicionar campos se não existirem
ALTER TABLE public.creator_earnings
ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES public.revenue_pool(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS month_year TEXT, -- Para facilitar consultas
ADD COLUMN IF NOT EXISTS pool_amount DECIMAL(12, 2), -- Valor total do pool no momento
ADD COLUMN IF NOT EXISTS downloads_in_pool INTEGER, -- Total de downloads no pool
ADD COLUMN IF NOT EXISTS commission_per_download DECIMAL(10, 4), -- Valor por download
ADD COLUMN IF NOT EXISTS payment_method TEXT, -- 'pix', 'bank_transfer', etc
ADD COLUMN IF NOT EXISTS payment_reference TEXT, -- Referência do pagamento
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON public.creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON public.creator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_month_year ON public.creator_earnings(month_year);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_pool_id ON public.creator_earnings(pool_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_created_at ON public.creator_earnings(created_at DESC);

-- ============================================================================
-- 3. FUNÇÃO: Obter ou criar pool do mês atual
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_current_pool()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
  v_pool_id UUID;
  v_commission_percentage DECIMAL(5, 2) := 30.00; -- Padrão 30%
BEGIN
  -- Obter mês/ano atual no formato YYYY-MM
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Tentar obter pool existente
  SELECT id INTO v_pool_id
  FROM public.revenue_pool
  WHERE month_year = v_month_year
  LIMIT 1;
  
  -- Se não existe, criar novo pool
  IF v_pool_id IS NULL THEN
    INSERT INTO public.revenue_pool (
      month_year,
      commission_percentage,
      status
    )
    VALUES (
      v_month_year,
      v_commission_percentage,
      'active'
    )
    RETURNING id INTO v_pool_id;
  END IF;
  
  RETURN v_pool_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_current_pool() IS 
'Retorna o ID do pool do mês atual, criando um novo se não existir';

-- ============================================================================
-- 4. FUNÇÃO: Calcular comissão por download baseado no Revenue Pool
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_commission_for_download(
  p_download_id UUID,
  p_resource_id UUID
)
RETURNS UUID -- Retorna o ID do creator_earning criado
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool_id UUID;
  v_pool RECORD;
  v_resource RECORD;
  v_creator_id UUID;
  v_month_year TEXT;
  v_commission_per_download DECIMAL(10, 4);
  v_commission_rate DECIMAL(5, 2);
  v_earning_id UUID;
  v_total_downloads INTEGER;
  v_already_has_earning BOOLEAN;
BEGIN
  -- Obter informações do recurso e criador
  SELECT 
    r.creator_id,
    r.id
  INTO v_resource
  FROM public.resources r
  WHERE r.id = p_resource_id
    AND r.status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurso não encontrado ou não aprovado';
  END IF;
  
  v_creator_id := v_resource.creator_id;
  
  -- Obter ou criar pool do mês atual
  v_pool_id := public.get_or_create_current_pool();
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- CRÍTICO: Verificar se já existe earning para este recurso neste mês
  -- Cada recurso só pode gerar UMA comissão por mês, independente de quantos downloads
  SELECT EXISTS(
    SELECT 1 
    FROM public.creator_earnings 
    WHERE resource_id = p_resource_id 
      AND month_year = v_month_year
  ) INTO v_already_has_earning;
  
  -- Se já existe earning para este recurso no mês, retornar o ID existente
  IF v_already_has_earning THEN
    SELECT id INTO v_earning_id
    FROM public.creator_earnings
    WHERE resource_id = p_resource_id 
      AND month_year = v_month_year
    LIMIT 1;
    
    -- Retornar o earning existente sem criar novo
    RETURN v_earning_id;
  END IF;
  
  -- Obter informações do pool
  SELECT 
    total_revenue,
    commission_percentage,
    total_downloads,
    remaining_amount,
    status
  INTO v_pool
  FROM public.revenue_pool
  WHERE id = v_pool_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool não encontrado';
  END IF;
  
  -- Se pool está fechado ou distribuído, não calcular comissão
  IF v_pool.status IN ('closed', 'distributed') THEN
    RAISE EXCEPTION 'Pool do mês atual está fechado ou distribuído';
  END IF;
  
  -- Sempre atualizar o pool antes de calcular comissão (garante dados atualizados)
  -- Isso garante que o pool sempre reflete o faturamento mais recente
  PERFORM public.update_revenue_pool_from_subscriptions();
  
  -- Buscar novamente o pool atualizado
  SELECT 
    total_revenue,
    commission_percentage,
    total_downloads,
    remaining_amount,
    status
  INTO v_pool
  FROM public.revenue_pool
  WHERE id = v_pool_id;
  
  -- Calcular valor disponível para distribuição
  DECLARE
    v_available_for_creators DECIMAL(12, 2);
    v_pool_amount DECIMAL(12, 2);
  BEGIN
    -- Valor total disponível para criadores = total_revenue * (commission_percentage / 100)
    v_available_for_creators := v_pool.total_revenue * (v_pool.commission_percentage / 100.0);
    v_pool_amount := v_available_for_creators;
    
    -- IMPORTANTE: No sistema Revenue Pool, o valor por download é recalculado a cada novo download
    -- Contamos quantos earnings já foram criados no mês (cada earning = 1 download único que gerou comissão)
    SELECT COUNT(*)
    INTO v_total_downloads
    FROM public.creator_earnings ce
    WHERE ce.month_year = v_month_year;
    
    -- Adicionar 1 para incluir o download atual que está sendo processado
    v_total_downloads := v_total_downloads + 1;
    
    -- Se não há downloads ainda, usar 1 para evitar divisão por zero
    IF v_total_downloads = 0 THEN
      v_total_downloads := 1;
    END IF;
    
    -- Calcular comissão por download = valor disponível / total de downloads (incluindo este)
    -- Isso garante que cada download recebe uma parte igual do pool
    v_commission_per_download := v_available_for_creators / v_total_downloads;
    
    -- Taxa de comissão (percentual)
    v_commission_rate := v_pool.commission_percentage;
    
    -- Criar registro de earning primeiro
    INSERT INTO public.creator_earnings (
      creator_id,
      resource_id,
      download_id,
      pool_id,
      month_year,
      amount,
      commission_rate,
      pool_amount,
      downloads_in_pool,
      commission_per_download,
      status
    )
    VALUES (
      v_creator_id,
      p_resource_id,
      p_download_id,
      v_pool_id,
      v_month_year,
      v_commission_per_download,
      v_commission_rate,
      v_pool_amount,
      v_total_downloads,
      v_commission_per_download,
      'pending'
    )
    RETURNING id INTO v_earning_id;
    
    -- IMPORTANTE: Recalcular comissões anteriores para manter proporção igual
    -- Quando um novo download é adicionado, o valor por download diminui
    -- Então precisamos atualizar todos os earnings anteriores do mês (exceto o que acabamos de criar)
    UPDATE public.creator_earnings
    SET 
      commission_per_download = v_commission_per_download,
      amount = v_commission_per_download,
      downloads_in_pool = v_total_downloads,
      pool_amount = v_pool_amount
    WHERE month_year = v_month_year
      AND id != v_earning_id;
    
    -- Atualizar pool: atualizar total_downloads e recalcular distributed_amount
    -- distributed_amount = soma de todos os earnings do mês
    DECLARE
      v_total_distributed DECIMAL(12, 2);
    BEGIN
      SELECT COALESCE(SUM(amount), 0)
      INTO v_total_distributed
      FROM public.creator_earnings
      WHERE month_year = v_month_year;
      
      UPDATE public.revenue_pool
      SET 
        total_downloads = v_total_downloads,
        distributed_amount = v_total_distributed,
        remaining_amount = (total_revenue * (commission_percentage / 100.0)) - v_total_distributed,
        updated_at = NOW()
      WHERE id = v_pool_id;
    END;
    
    RETURN v_earning_id;
  END;
END;
$$;

COMMENT ON FUNCTION public.calculate_commission_for_download(UUID, UUID) IS 
'Calcula e registra comissão para o criador baseado no Revenue Pool atual. Retorna o ID do earning criado.';

-- ============================================================================
-- 5. ATUALIZAR: Função register_download para calcular comissão automaticamente
-- ============================================================================

-- Primeiro, vamos criar uma nova versão da função que chama o cálculo de comissão
-- Mas apenas para downloads NOVOS (is_new_download = true)

-- Nota: Não vamos modificar a função register_download diretamente aqui
-- Vamos criar um trigger que chama o cálculo de comissão após o download ser registrado

-- ============================================================================
-- 6. TRIGGER: Calcular comissão automaticamente após download
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_calculate_commission_on_download()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
  v_already_has_earning BOOLEAN;
  v_earning_id UUID;
BEGIN
  -- CRÍTICO: Verificar se já existe earning para este recurso neste mês
  -- Cada recurso só pode gerar UMA comissão por mês, independente de quantos downloads
  -- Isso evita que o mesmo recurso gere múltiplas comissões quando baixado várias vezes
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Verificar se já existe earning para este recurso no mês atual
  SELECT EXISTS(
    SELECT 1 
    FROM public.creator_earnings 
    WHERE resource_id = NEW.resource_id 
      AND month_year = v_month_year
  ) INTO v_already_has_earning;
  
  -- Se já existe earning para este recurso no mês, não calcular novamente
  IF v_already_has_earning THEN
    RETURN NEW;
  END IF;
  
  -- Se não existe earning, verificar se recurso está aprovado e calcular comissão
  IF EXISTS (
    SELECT 1 
    FROM public.resources 
    WHERE id = NEW.resource_id 
    AND status = 'approved'
  ) THEN
    BEGIN
      -- Calcular comissão (pode falhar se pool estiver fechado, mas não queremos bloquear o download)
      v_earning_id := public.calculate_commission_for_download(NEW.id, NEW.resource_id);
      
      -- Log de sucesso (opcional)
      -- RAISE NOTICE 'Comissão calculada: earning_id = %', v_earning_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Se falhar, apenas logar o erro mas não bloquear o download
        RAISE WARNING 'Erro ao calcular comissão para download %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_calculate_commission_on_download() IS 
'Trigger que calcula comissão automaticamente após um download ser registrado (apenas para downloads novos)';

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_calculate_commission_on_download ON public.downloads;
CREATE TRIGGER trigger_calculate_commission_on_download
  AFTER INSERT ON public.downloads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_commission_on_download();

-- ============================================================================
-- 7. FUNÇÃO: Atualizar revenue pool com receita de assinaturas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_revenue_pool_from_subscriptions()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  total_revenue DECIMAL(12, 2),
  transactions_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
  v_pool_id UUID;
  v_total_revenue DECIMAL(12, 2);
  v_transactions_count INTEGER;
BEGIN
  -- Obter mês/ano atual
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Obter ou criar pool
  v_pool_id := public.get_or_create_current_pool();
  
  -- Calcular receita total do mês atual de assinaturas ativas
  -- Considerar apenas pagamentos confirmados do mês atual
  -- Usar amount_liquid (valor líquido após taxas) para o pool
  SELECT 
    COALESCE(SUM(t.amount_liquid), 0),
    COUNT(*)
  INTO v_total_revenue, v_transactions_count
  FROM public.transactions t
  WHERE t.status = 'paid'
    AND DATE_TRUNC('month', t.created_at AT TIME ZONE 'America/Sao_Paulo') = 
        DATE_TRUNC('month', CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo');
  
  -- Atualizar pool
  UPDATE public.revenue_pool
  SET 
    total_revenue = v_total_revenue,
    remaining_amount = (v_total_revenue * (commission_percentage / 100.0)) - distributed_amount,
    updated_at = NOW()
  WHERE id = v_pool_id;
  
  -- Recalcular todas as comissões do mês se houver receita
  IF v_total_revenue > 0 THEN
    -- Recalcular comissões existentes
    PERFORM public.recalculate_month_earnings(v_month_year);
  END IF;
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    format('Pool atualizado com sucesso. Receita: %s de %s transações', 
           v_total_revenue, v_transactions_count)::TEXT,
    v_total_revenue,
    v_transactions_count;
END;
$$;

COMMENT ON FUNCTION public.update_revenue_pool_from_subscriptions() IS 
'Atualiza o revenue pool do mês atual com a receita total de assinaturas pagas e recalcula comissões';

-- ============================================================================
-- 7.1. FUNÇÃO: Recalcular comissões de um mês específico
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_month_earnings(p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool RECORD;
  v_total_downloads INTEGER;
  v_available_for_creators DECIMAL(12, 2);
  v_commission_per_download DECIMAL(10, 4);
BEGIN
  -- Buscar pool
  SELECT * INTO v_pool
  FROM public.revenue_pool
  WHERE month_year = p_month_year;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Se pool está zerado, não recalcular
  IF v_pool.total_revenue = 0 THEN
    RETURN;
  END IF;
  
  -- Calcular valor disponível
  v_available_for_creators := v_pool.total_revenue * (v_pool.commission_percentage / 100.0);
  
  -- Contar downloads únicos do mês
  SELECT COUNT(*) INTO v_total_downloads
  FROM public.creator_earnings
  WHERE month_year = p_month_year;
  
  IF v_total_downloads = 0 THEN
    RETURN;
  END IF;
  
  -- Calcular novo valor por download
  v_commission_per_download := v_available_for_creators / v_total_downloads;
  
  -- Atualizar todos os earnings do mês
  UPDATE public.creator_earnings
  SET 
    amount = v_commission_per_download,
    commission_per_download = v_commission_per_download,
    pool_amount = v_available_for_creators,
    downloads_in_pool = v_total_downloads
  WHERE month_year = p_month_year;
  
  -- Atualizar pool
  UPDATE public.revenue_pool
  SET 
    total_downloads = v_total_downloads,
    distributed_amount = v_commission_per_download * v_total_downloads,
    remaining_amount = v_available_for_creators - (v_commission_per_download * v_total_downloads),
    updated_at = NOW()
  WHERE month_year = p_month_year;
END;
$$;

COMMENT ON FUNCTION public.recalculate_month_earnings(TEXT) IS 
'Recalcula todas as comissões de um mês específico baseado no pool atualizado';

-- ============================================================================
-- 8. FUNÇÃO: Fechar pool do mês (quando mês termina)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.close_revenue_pool(p_month_year TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool RECORD;
BEGIN
  -- Buscar pool
  SELECT * INTO v_pool
  FROM public.revenue_pool
  WHERE month_year = p_month_year;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool não encontrado para o mês %', p_month_year;
  END IF;
  
  IF v_pool.status != 'active' THEN
    RAISE EXCEPTION 'Pool já está fechado ou distribuído';
  END IF;
  
  -- Fechar pool
  UPDATE public.revenue_pool
  SET 
    status = 'closed',
    closed_at = NOW(),
    updated_at = NOW()
  WHERE month_year = p_month_year;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.close_revenue_pool(TEXT) IS 
'Fecha um pool de receita (usado quando o mês termina)';

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

-- Revenue Pool: apenas admins podem ver e modificar
ALTER TABLE public.revenue_pool ENABLE ROW LEVEL SECURITY;

-- Remover policies existentes antes de criar
DROP POLICY IF EXISTS "Admins can view revenue pools" ON public.revenue_pool;
DROP POLICY IF EXISTS "Admins can manage revenue pools" ON public.revenue_pool;

CREATE POLICY "Admins can view revenue pools"
  ON public.revenue_pool FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can manage revenue pools"
  ON public.revenue_pool FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Creator Earnings: criadores podem ver apenas seus próprios earnings
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- Política existente pode já existir, vamos garantir
DROP POLICY IF EXISTS "Creators can view own earnings" ON public.creator_earnings;
CREATE POLICY "Creators can view own earnings"
  ON public.creator_earnings FOR SELECT
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Admins can view all earnings" ON public.creator_earnings;
CREATE POLICY "Admins can view all earnings"
  ON public.creator_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update earnings" ON public.creator_earnings;
CREATE POLICY "Admins can update earnings"
  ON public.creator_earnings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- 10. TRIGGER: Atualizar pool automaticamente quando transação é paga
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_update_pool_on_transaction_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas atualizar se o status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Atualizar pool do mês da transação
    PERFORM public.update_revenue_pool_from_subscriptions();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_update_pool_on_transaction_paid() IS 
'Atualiza automaticamente o revenue pool quando uma transação é marcada como paga';

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_pool_on_transaction_paid ON public.transactions;
CREATE TRIGGER trigger_update_pool_on_transaction_paid
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.trigger_update_pool_on_transaction_paid();

-- ============================================================================
-- 11. ATUALIZAR POOLS EXISTENTES PARA 30%
-- ============================================================================

-- Atualizar pools existentes que ainda estão com 50% para 30%
UPDATE public.revenue_pool
SET commission_percentage = 30.00
WHERE commission_percentage = 50.00
  AND status = 'active';

-- ============================================================================
-- 12. ÍNDICES ADICIONAIS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_revenue_pool_month_year ON public.revenue_pool(month_year);
CREATE INDEX IF NOT EXISTS idx_revenue_pool_status ON public.revenue_pool(status);
CREATE INDEX IF NOT EXISTS idx_downloads_month ON public.downloads(DATE_TRUNC('month', COALESCE(created_at, downloaded_at) AT TIME ZONE 'America/Sao_Paulo'));
CREATE INDEX IF NOT EXISTS idx_transactions_month_status ON public.transactions(
  DATE_TRUNC('month', created_at AT TIME ZONE 'America/Sao_Paulo'), 
  status
);

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================


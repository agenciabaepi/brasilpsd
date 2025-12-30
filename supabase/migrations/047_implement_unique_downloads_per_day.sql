-- ============================================================================
-- Migration: 047 - Implementar Downloads Únicos por Dia
-- Descrição: Modifica o sistema de downloads para contar apenas recursos únicos
--            por dia. Se o usuário baixar o mesmo arquivo várias vezes no mesmo
--            dia, conta apenas como 1 download. Se atingir o limite, não pode
--            baixar mais nenhum arquivo, mesmo que tenha baixado o mesmo antes.
-- Data: 2024-12-30
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO: Verificar se usuário já baixou o recurso hoje
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_user_downloaded_resource_today(
  p_user_id UUID,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_today_start TIMESTAMP WITH TIME ZONE;
  v_today_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Definir início e fim do dia atual no timezone do Brasil
  v_today_start := (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  v_today_end := v_today_start + INTERVAL '1 day';
  
  -- Verificar se já existe download deste recurso pelo usuário hoje
  SELECT EXISTS(
    SELECT 1
    FROM public.downloads
    WHERE user_id = p_user_id
      AND resource_id = p_resource_id
      AND COALESCE(created_at, downloaded_at) >= v_today_start
      AND COALESCE(created_at, downloaded_at) < v_today_end
  ) INTO v_exists;
  
  RETURN COALESCE(v_exists, false);
END;
$$;

COMMENT ON FUNCTION public.has_user_downloaded_resource_today(UUID, UUID) IS 
'Verifica se o usuário já baixou o recurso específico hoje. Retorna true se já baixou, false caso contrário.';

-- ============================================================================
-- 2. FUNÇÃO: Contar recursos únicos baixados hoje (não downloads totais)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_unique_resources_downloaded_today(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_today_start TIMESTAMP WITH TIME ZONE;
  v_today_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Definir início e fim do dia atual no timezone do Brasil
  v_today_start := (CURRENT_DATE::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  v_today_end := v_today_start + INTERVAL '1 day';
  
  -- Contar recursos ÚNICOS baixados hoje (DISTINCT resource_id)
  -- Isso garante que múltiplos downloads do mesmo recurso contem apenas como 1
  SELECT COUNT(DISTINCT resource_id)
  INTO v_count
  FROM public.downloads
  WHERE user_id = p_user_id
    AND COALESCE(created_at, downloaded_at) >= v_today_start
    AND COALESCE(created_at, downloaded_at) < v_today_end;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.count_unique_resources_downloaded_today(UUID) IS 
'Conta quantos recursos ÚNICOS o usuário baixou hoje. Múltiplos downloads do mesmo recurso contam apenas como 1.';

-- ============================================================================
-- 3. ATUALIZAR: Função count_user_downloads_today para usar recursos únicos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_user_downloads_today(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Usar a nova função que conta recursos únicos
  RETURN public.count_unique_resources_downloaded_today(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.count_user_downloads_today(UUID) IS 
'Conta quantos recursos únicos o usuário baixou hoje. Múltiplos downloads do mesmo recurso contam apenas como 1.';

-- ============================================================================
-- 4. ATUALIZAR: Função register_download para verificar se já foi baixado hoje
-- ============================================================================

-- IMPORTANTE: Fazer DROP da função existente porque estamos mudando o tipo de retorno
-- (adicionando campo is_new_download)
DROP FUNCTION IF EXISTS public.register_download(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.register_download(
  p_user_id UUID,
  p_resource_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  download_id UUID,
  current_count INTEGER,
  limit_count INTEGER,
  remaining INTEGER,
  is_new_download BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status RECORD;
  v_download_id UUID;
  v_resource_exists BOOLEAN;
  v_already_downloaded_today BOOLEAN;
  v_is_new_download BOOLEAN;
  v_current_count_before INTEGER;
  v_current_count_after INTEGER;
BEGIN
  -- ========================================================================
  -- VALIDAÇÃO 1: Verificar se o recurso existe e está aprovado
  -- ========================================================================
  SELECT EXISTS(
    SELECT 1 
    FROM public.resources 
    WHERE id = p_resource_id 
    AND status = 'approved'
  ) INTO v_resource_exists;
  
  IF NOT v_resource_exists THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Recurso não encontrado ou não aprovado'::TEXT,
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,
      0::INTEGER,
      false::BOOLEAN;
    RETURN;
  END IF;
  
  -- ========================================================================
  -- VALIDAÇÃO 2: Verificar se já baixou este recurso hoje
  -- ========================================================================
  v_already_downloaded_today := public.has_user_downloaded_resource_today(p_user_id, p_resource_id);
  v_is_new_download := NOT v_already_downloaded_today;
  
  -- ========================================================================
  -- VALIDAÇÃO 3: Se for um novo download, verificar limite ANTES de inserir
  -- ========================================================================
  IF v_is_new_download THEN
    -- Lock na linha do usuário para garantir atomicidade
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    
    -- Obter status atual (contando recursos únicos)
    SELECT * INTO v_status
    FROM public.get_user_download_status(p_user_id);
    
    -- Guardar contagem antes
    v_current_count_before := v_status.current_count;
    
    -- Se já atingiu o limite, bloquear
    IF NOT v_status.allowed THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        format('Limite de downloads excedido. Você já baixou %s recursos únicos de %s permitidos hoje.', 
               v_status.current_count, v_status.limit_count)::TEXT,
        NULL::UUID,
        v_status.current_count,
        v_status.limit_count,
        v_status.remaining,
        false::BOOLEAN;
      RETURN;
    END IF;
  ELSE
    -- Se já baixou hoje, obter status sem lock (não vai contar como novo)
    SELECT * INTO v_status
    FROM public.get_user_download_status(p_user_id);
    v_current_count_before := v_status.current_count;
  END IF;
  
  -- ========================================================================
  -- INSERÇÃO: Registrar o download (sempre registrar, mesmo se já baixou hoje)
  -- ========================================================================
  INSERT INTO public.downloads (
    user_id,
    resource_id,
    ip_address,
    user_agent,
    created_at,
    downloaded_at
  )
  VALUES (
    p_user_id,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_download_id;
  
  -- ========================================================================
  -- VALIDAÇÃO 4: Se foi novo download, verificar novamente após inserção
  -- ========================================================================
  IF v_is_new_download THEN
    -- Recontar para garantir que não ultrapassou o limite
    SELECT * INTO v_status
    FROM public.get_user_download_status(p_user_id);
    
    v_current_count_after := v_status.current_count;
    
    -- Se após inserir ultrapassou o limite, fazer rollback
    IF v_status.current_count > v_status.limit_count THEN
      -- Rollback da transação (exceção)
      RAISE EXCEPTION 'Limite de downloads excedido após validação. Operação cancelada.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Se já tinha baixado, manter a contagem anterior
    v_current_count_after := v_current_count_before;
  END IF;
  
  -- ========================================================================
  -- SUCESSO: Retornar informações do download registrado
  -- ========================================================================
  RETURN QUERY SELECT 
    true::BOOLEAN,
    CASE 
      WHEN v_is_new_download THEN 'Download registrado com sucesso'
      ELSE 'Download permitido (recurso já baixado hoje, não conta como novo download)'
    END::TEXT,
    v_download_id,
    v_current_count_after,
    v_status.limit_count,
    GREATEST(0, v_status.limit_count - v_current_count_after),
    v_is_new_download;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retornar falha
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('Erro ao registrar download: %s', SQLERRM)::TEXT,
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,
      0::INTEGER,
      false::BOOLEAN;
END;
$$;

COMMENT ON FUNCTION public.register_download(UUID, UUID, TEXT, TEXT) IS 
'Registra um download com validação completa. Se o recurso já foi baixado hoje, permite o download mas não conta como novo. Se for novo, valida limite ANTES de inserir. Retorna sucesso/erro com detalhes e indica se foi novo download.';

-- ============================================================================
-- 5. ÍNDICE: Otimizar consulta de downloads por usuário e recurso no dia
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_downloads_user_resource_date 
ON public.downloads(user_id, resource_id, DATE(COALESCE(created_at, downloaded_at) AT TIME ZONE 'America/Sao_Paulo'));

COMMENT ON INDEX idx_downloads_user_resource_date IS 
'Índice para otimizar verificação se usuário já baixou recurso específico hoje';


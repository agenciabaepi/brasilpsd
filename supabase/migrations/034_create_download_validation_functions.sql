-- ============================================================================
-- Migration: 034 - Funções de Validação de Downloads
-- Descrição: Funções server-side para validação segura de downloads
-- Data: 2024
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO: Verificar se usuário pode fazer download
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_download_limit(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_status RECORD;
BEGIN
  -- Usar a função existente para obter o status
  SELECT * INTO v_status
  FROM public.get_user_download_status(p_user_id);
  
  -- Retornar no formato especificado
  RETURN QUERY SELECT 
    v_status.allowed,
    v_status.current_count,
    v_status.limit_count,
    v_status.remaining;
END;
$$;

COMMENT ON FUNCTION public.check_download_limit(UUID) IS 
'Verifica se o usuário pode fazer download. Retorna: allowed, current_count, limit_count, remaining';

-- ============================================================================
-- 2. FUNÇÃO: Registrar download com validação e transação atômica
-- ============================================================================

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
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status RECORD;
  v_download_id UUID;
  v_resource_exists BOOLEAN;
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
      0::INTEGER;
    RETURN;
  END IF;
  
  -- ========================================================================
  -- VALIDAÇÃO 2: Verificar limite de downloads (ANTES de inserir)
  -- Usar LOCK para prevenir race conditions em requisições simultâneas
  -- ========================================================================
  -- Lock na linha do usuário para garantir atomicidade
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  
  SELECT * INTO v_status
  FROM public.get_user_download_status(p_user_id);
  
  IF NOT v_status.allowed THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('Limite de downloads excedido. Você já fez %s de %s downloads hoje.', 
             v_status.current_count, v_status.limit_count)::TEXT,
      NULL::UUID,
      v_status.current_count,
      v_status.limit_count,
      v_status.remaining;
    RETURN;
  END IF;
  
  -- ========================================================================
  -- INSERÇÃO: Registrar o download (dentro da transação implícita)
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
  -- VALIDAÇÃO 3: Verificar novamente após inserção (double-check)
  -- ========================================================================
  -- Recontar para garantir que não ultrapassou o limite
  -- (proteção adicional contra race conditions)
  SELECT * INTO v_status
  FROM public.get_user_download_status(p_user_id);
  
  -- Se após inserir ultrapassou o limite, fazer rollback
  IF v_status.current_count > v_status.limit_count THEN
    -- Rollback da transação (exceção)
    RAISE EXCEPTION 'Limite de downloads excedido após validação. Operação cancelada.'
      USING ERRCODE = 'P0001';
  END IF;
  
  -- ========================================================================
  -- SUCESSO: Retornar informações do download registrado
  -- ========================================================================
  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Download registrado com sucesso'::TEXT,
    v_download_id,
    v_status.current_count,
    v_status.limit_count,
    v_status.remaining;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retornar falha
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('Erro ao registrar download: %s', SQLERRM)::TEXT,
      NULL::UUID,
      0::INTEGER,
      0::INTEGER,
      0::INTEGER;
END;
$$;

COMMENT ON FUNCTION public.register_download(UUID, UUID, TEXT, TEXT) IS 
'Registra um download com validação completa. Valida limite ANTES de inserir e usa transação atômica. Retorna sucesso/erro com detalhes';

-- ============================================================================
-- 3. FUNÇÃO: Verificar se usuário pode fazer download de um recurso específico
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_user_download_resource(
  p_user_id UUID,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_allowed BOOLEAN;
  v_resource_approved BOOLEAN;
  v_download_status RECORD;
BEGIN
  -- Verificar se o recurso existe e está aprovado
  SELECT EXISTS(
    SELECT 1 
    FROM public.resources 
    WHERE id = p_resource_id 
    AND status = 'approved'
  ) INTO v_resource_approved;
  
  IF NOT v_resource_approved THEN
    RETURN false;
  END IF;
  
  -- Verificar limite de downloads
  SELECT allowed INTO v_allowed
  FROM public.check_download_limit(p_user_id);
  
  RETURN COALESCE(v_allowed, false);
END;
$$;

COMMENT ON FUNCTION public.can_user_download_resource(UUID, UUID) IS 
'Verifica se o usuário pode fazer download de um recurso específico (recurso aprovado + limite não excedido)';

-- ============================================================================
-- 4. TRIGGER: Validação adicional antes de inserir download
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_download_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed BOOLEAN;
  v_current_count INTEGER;
  v_limit_count INTEGER;
  v_error_message TEXT;
BEGIN
  -- Verificar limite de downloads
  SELECT 
    allowed,
    current_count,
    limit_count
  INTO 
    v_allowed,
    v_current_count,
    v_limit_count
  FROM public.check_download_limit(NEW.user_id);
  
  -- Se não permitido, impedir inserção
  IF NOT v_allowed THEN
    -- Formatar mensagem de erro
    v_error_message := format('Limite de downloads excedido. Você já fez %s downloads de %s permitidos hoje. Tente novamente amanhã.', 
                              v_current_count, v_limit_count);
    
    RAISE EXCEPTION '%', v_error_message
      USING ERRCODE = 'P0001';
  END IF;
  
  -- Garantir que created_at e downloaded_at estão preenchidos
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  IF NEW.downloaded_at IS NULL THEN
    NEW.downloaded_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger (como camada adicional de segurança)
-- NOTA: Este trigger é uma camada extra de proteção, mas a validação principal
-- deve ser feita através da função register_download
DROP TRIGGER IF EXISTS trigger_validate_download_before_insert ON public.downloads;
CREATE TRIGGER trigger_validate_download_before_insert
  BEFORE INSERT ON public.downloads
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_download_before_insert();

COMMENT ON TRIGGER trigger_validate_download_before_insert ON public.downloads IS 
'Trigger de validação adicional que impede inserção direta de downloads quando limite é excedido';

-- ============================================================================
-- 5. POLÍTICAS RLS PARA DOWNLOADS (atualizar existentes)
-- ============================================================================

-- Atualizar política de visualização para incluir admins
DROP POLICY IF EXISTS "Users can view own downloads" ON public.downloads;
CREATE POLICY "Users can view own downloads"
  ON public.downloads FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Atualizar política de inserção (mantém compatibilidade)
-- NOTA: Recomendamos usar register_download() em vez de INSERT direto
DROP POLICY IF EXISTS "Users can create downloads" ON public.downloads;
CREATE POLICY "Users can create downloads"
  ON public.downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Garantir que as funções sejam acessíveis
GRANT EXECUTE ON FUNCTION public.check_download_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_download(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_download_resource(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_download_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_downloads_today(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_download_limit(TEXT) TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================


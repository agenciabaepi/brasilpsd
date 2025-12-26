-- ============================================================================
-- Migration: 035 - Corrigir validação de register_download
-- Descrição: Remover validação de status aprovado da função, deixando apenas
--            verificação de existência. A validação de status deve ser feita na API.
-- Data: 2024
-- ============================================================================

-- Atualizar função register_download para remover validação de status
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
  -- VALIDAÇÃO 1: Verificar se o recurso existe (sem validar status)
  -- A validação de status (aprovado/criador/admin) deve ser feita na API
  -- ========================================================================
  SELECT EXISTS(
    SELECT 1 
    FROM public.resources 
    WHERE id = p_resource_id
  ) INTO v_resource_exists;
  
  IF NOT v_resource_exists THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Recurso não encontrado'::TEXT,
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
'Registra um download com validação completa. Valida limite ANTES de inserir e usa transação atômica. Retorna sucesso/erro com detalhes. NOTA: Validação de status do recurso deve ser feita na API.';


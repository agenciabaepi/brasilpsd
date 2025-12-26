-- Tabela para códigos de verificação de email
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca rápida por email e código
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON public.email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_code ON public.email_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON public.email_verification_codes(expires_at);

-- Função para limpar códigos expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW() OR verified = true;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
-- Remover políticas existentes se houver (para evitar erro de duplicação)
DROP POLICY IF EXISTS "Allow insert for verification codes" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Allow read unverified codes" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Allow update to verify codes" ON public.email_verification_codes;

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Permitir inserção de códigos (público, mas controlado pela API)
CREATE POLICY "Allow insert for verification codes"
  ON public.email_verification_codes FOR INSERT
  WITH CHECK (true);

-- Permitir leitura apenas de códigos não verificados e não expirados
CREATE POLICY "Allow read unverified codes"
  ON public.email_verification_codes FOR SELECT
  USING (verified = false AND expires_at > NOW());

-- Permitir atualização para marcar como verificado (público, controlado pela API)
CREATE POLICY "Allow update to verify codes"
  ON public.email_verification_codes FOR UPDATE
  USING (true)
  WITH CHECK (true);


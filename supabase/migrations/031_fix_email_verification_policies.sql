-- Fix: Remover e recriar políticas de verificação de email
-- Use este script se as políticas já existem e você precisa recriá-las

-- Remover políticas existentes
DROP POLICY IF EXISTS "Allow insert for verification codes" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Allow read unverified codes" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Allow update to verify codes" ON public.email_verification_codes;

-- Recriar políticas
CREATE POLICY "Allow insert for verification codes"
  ON public.email_verification_codes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow read unverified codes"
  ON public.email_verification_codes FOR SELECT
  USING (verified = false AND expires_at > NOW());

CREATE POLICY "Allow update to verify codes"
  ON public.email_verification_codes FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Alternativa: Se ainda houver problemas, desabilitar RLS temporariamente
-- ALTER TABLE public.email_verification_codes DISABLE ROW LEVEL SECURITY;



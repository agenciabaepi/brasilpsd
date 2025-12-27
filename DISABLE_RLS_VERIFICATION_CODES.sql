-- Script rápido: Desabilitar RLS para tabela de códigos de verificação
-- Use este script se as políticas RLS estão causando problemas

ALTER TABLE public.email_verification_codes DISABLE ROW LEVEL SECURITY;

-- Para reabilitar RLS depois (se necessário):
-- ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;



-- Adicionar campo para armazenar o ID do cliente no Asaas
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

COMMENT ON COLUMN public.profiles.asaas_customer_id IS 'ID do cliente no sistema Asaas para gerenciamento de assinaturas';


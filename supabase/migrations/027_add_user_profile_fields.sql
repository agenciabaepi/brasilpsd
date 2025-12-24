-- Adicionar campos de dados pessoais e endereço na tabela profiles
-- Baseado no painel de configurações do usuário

-- Dados Pessoais
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
-- Endereço
ADD COLUMN IF NOT EXISTS postal_code TEXT, -- CEP
ADD COLUMN IF NOT EXISTS city TEXT, -- Cidade
ADD COLUMN IF NOT EXISTS state TEXT, -- Estado
ADD COLUMN IF NOT EXISTS address TEXT, -- Endereço/Quadra
ADD COLUMN IF NOT EXISTS address_number TEXT, -- Número/Lote
ADD COLUMN IF NOT EXISTS neighborhood TEXT; -- Bairro

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.cpf_cnpj IS 'CPF ou CNPJ do usuário';
COMMENT ON COLUMN public.profiles.phone IS 'Telefone de contato';
COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento';
COMMENT ON COLUMN public.profiles.postal_code IS 'CEP do endereço';
COMMENT ON COLUMN public.profiles.city IS 'Cidade';
COMMENT ON COLUMN public.profiles.state IS 'Estado (UF)';
COMMENT ON COLUMN public.profiles.address IS 'Endereço completo ou Quadra';
COMMENT ON COLUMN public.profiles.address_number IS 'Número ou Lote';
COMMENT ON COLUMN public.profiles.neighborhood IS 'Bairro';

-- Índices para busca (opcional, mas útil)
CREATE INDEX IF NOT EXISTS idx_profiles_postal_code ON public.profiles(postal_code);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);


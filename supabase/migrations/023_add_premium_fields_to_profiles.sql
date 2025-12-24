-- Adicionar campos de assinatura premium na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

-- Adicionar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium ON public.profiles(is_premium);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.is_premium IS 'Indica se o usuário possui assinatura premium ativa';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'Tier da assinatura: free, lite, pro, ou plus';



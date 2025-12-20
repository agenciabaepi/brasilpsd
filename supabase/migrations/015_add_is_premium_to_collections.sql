-- Adicionar campo is_premium na tabela collections
ALTER TABLE public.collections 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Adicionar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_collections_is_premium ON public.collections(is_premium);


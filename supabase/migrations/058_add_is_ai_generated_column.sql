-- Adicionar coluna para marcar recursos gerados por IA
ALTER TABLE public.resources 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;

-- Adicionar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_resources_is_ai_generated 
ON public.resources(is_ai_generated) 
WHERE is_ai_generated = true;

-- Comentário na coluna
COMMENT ON COLUMN public.resources.is_ai_generated IS 'Indica se o recurso foi gerado por inteligência artificial (detectado automaticamente ou marcado manualmente)';


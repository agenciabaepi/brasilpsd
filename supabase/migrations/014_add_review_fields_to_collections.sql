-- Adicionar campos de revisão à tabela collections
-- Similar aos campos existentes na tabela resources

ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Comentários
COMMENT ON COLUMN public.collections.rejected_reason IS 'Motivo da rejeição quando status = rejected';
COMMENT ON COLUMN public.collections.reviewed_by IS 'ID do admin que revisou a coleção';
COMMENT ON COLUMN public.collections.reviewed_at IS 'Data e hora da revisão';


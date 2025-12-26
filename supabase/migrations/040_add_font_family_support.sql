-- Adicionar suporte para famílias de fontes
-- Permite agrupar múltiplas variações de uma mesma fonte (Regular, Bold, Italic, etc.)

-- 1. Adicionar campo font_family_id na tabela resources
-- Este campo referencia o ID da fonte "principal" da família
-- Se NULL, a fonte é independente ou é a principal da família
-- Se preenchido, indica que esta fonte pertence à família da fonte referenciada
ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS font_family_id UUID REFERENCES public.resources(id) ON DELETE SET NULL;

-- 2. Adicionar campo font_weight para identificar o peso da fonte (Regular, Bold, Thin, etc.)
ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS font_weight TEXT;

-- 3. Adicionar campo font_style para identificar o estilo (Normal, Italic, Oblique)
ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS font_style TEXT DEFAULT 'Normal';

-- 4. Criar índice para melhorar performance nas consultas de famílias
CREATE INDEX IF NOT EXISTS idx_resources_font_family_id 
ON public.resources(font_family_id) 
WHERE font_family_id IS NOT NULL;

-- 5. Criar índice para fontes (para consultas mais rápidas)
CREATE INDEX IF NOT EXISTS idx_resources_font_type 
ON public.resources(resource_type) 
WHERE resource_type = 'font';

-- 6. Comentários para documentação
COMMENT ON COLUMN public.resources.font_family_id IS 'ID da fonte principal da família. NULL se for fonte independente ou principal.';
COMMENT ON COLUMN public.resources.font_weight IS 'Peso da fonte: Regular, Bold, Thin, Light, Medium, SemiBold, ExtraBold, Black, etc.';
COMMENT ON COLUMN public.resources.font_style IS 'Estilo da fonte: Normal, Italic, Oblique';

-- 7. Função helper para obter todas as fontes de uma família
CREATE OR REPLACE FUNCTION public.get_font_family(family_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  font_weight TEXT,
  font_style TEXT,
  file_url TEXT,
  file_format TEXT,
  file_size BIGINT,
  download_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.font_weight,
    r.font_style,
    r.file_url,
    r.file_format,
    r.file_size,
    r.download_count
  FROM public.resources r
  WHERE r.resource_type = 'font'
    AND r.status = 'approved'
    AND (
      r.id = family_id 
      OR r.font_family_id = family_id
    )
  ORDER BY 
    CASE r.font_weight
      WHEN 'Thin' THEN 1
      WHEN 'ExtraLight' THEN 2
      WHEN 'Light' THEN 3
      WHEN 'Regular' THEN 4
      WHEN 'Medium' THEN 5
      WHEN 'SemiBold' THEN 6
      WHEN 'Bold' THEN 7
      WHEN 'ExtraBold' THEN 8
      WHEN 'Black' THEN 9
      ELSE 10
    END,
    r.font_style,
    r.title;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Comentário na função
COMMENT ON FUNCTION public.get_font_family(UUID) IS 'Retorna todas as variações de uma família de fontes ordenadas por peso e estilo';


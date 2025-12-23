-- ============================================
-- APLICAR TODAS AS MIGRATIONS DE METADADOS DE VÍDEO
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Migration 017: Campos básicos de metadados de vídeo
ALTER TABLE public.resources 
ADD COLUMN IF NOT EXISTS frame_rate DECIMAL(5, 2), -- Taxa de quadros (fps)
ADD COLUMN IF NOT EXISTS has_alpha_channel BOOLEAN DEFAULT false, -- Canal alfa
ADD COLUMN IF NOT EXISTS has_loop BOOLEAN DEFAULT false, -- Com loop
ADD COLUMN IF NOT EXISTS video_encoding TEXT, -- Codificação de vídeo (H.264, H.265, etc)
ADD COLUMN IF NOT EXISTS orientation TEXT; -- Orientação (Horizontal, Vertical, Quadrado)

-- Adicionar índice para consultas por tipo de recurso
CREATE INDEX IF NOT EXISTS idx_resources_video_metadata ON public.resources(resource_type, frame_rate, has_alpha_channel) 
WHERE resource_type = 'video';

-- Migration 018: Campos avançados de metadados de vídeo
ALTER TABLE public.resources 
ADD COLUMN IF NOT EXISTS video_codec TEXT, -- Codec formatado (ex: "Apple ProRes 422")
ADD COLUMN IF NOT EXISTS video_color_space TEXT, -- Espaço de cor (ex: "bt709", "smpte170m")
ADD COLUMN IF NOT EXISTS video_has_timecode BOOLEAN DEFAULT false, -- Se o vídeo tem timecode
ADD COLUMN IF NOT EXISTS video_audio_codec TEXT; -- Codec de áudio (ex: "aac", "pcm")

-- Comentários para documentação
COMMENT ON COLUMN public.resources.video_codec IS 'Codec de vídeo formatado (ex: Apple ProRes 422, H.264)';
COMMENT ON COLUMN public.resources.video_color_space IS 'Espaço de cor do vídeo (ex: bt709, smpte170m)';
COMMENT ON COLUMN public.resources.video_has_timecode IS 'Indica se o vídeo contém timecode';
COMMENT ON COLUMN public.resources.video_audio_codec IS 'Codec de áudio do vídeo (ex: aac, pcm)';

-- Verificar se as colunas foram criadas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'resources' 
  AND column_name IN (
    'frame_rate', 
    'has_alpha_channel', 
    'has_loop', 
    'video_encoding', 
    'orientation',
    'video_codec',
    'video_color_space',
    'video_has_timecode',
    'video_audio_codec'
  )
ORDER BY column_name;


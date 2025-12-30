-- Adicionar campos de metadados de vídeo na tabela resources
ALTER TABLE public.resources 
ADD COLUMN IF NOT EXISTS frame_rate DECIMAL(5, 2), -- Taxa de quadros (fps)
ADD COLUMN IF NOT EXISTS has_alpha_channel BOOLEAN DEFAULT false, -- Canal alfa
ADD COLUMN IF NOT EXISTS has_loop BOOLEAN DEFAULT false, -- Com loop
ADD COLUMN IF NOT EXISTS video_encoding TEXT, -- Codificação de vídeo (H.264, H.265, etc)
ADD COLUMN IF NOT EXISTS orientation TEXT; -- Orientação (Horizontal, Vertical, Quadrado)

-- Adicionar índice para consultas por tipo de recurso
CREATE INDEX IF NOT EXISTS idx_resources_video_metadata ON public.resources(resource_type, frame_rate, has_alpha_channel) 
WHERE resource_type = 'video';









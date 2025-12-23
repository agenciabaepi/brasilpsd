-- Adicionar campos adicionais de metadados de vídeo
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


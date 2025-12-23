-- Adicionar campo para imagem de capa (banner) do perfil
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cover_image TEXT;

COMMENT ON COLUMN public.profiles.cover_image IS 'URL da imagem de capa/banner do perfil do usuário';






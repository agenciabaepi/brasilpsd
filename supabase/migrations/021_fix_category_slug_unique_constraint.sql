-- Corrigir constraint UNIQUE do slug para permitir slugs duplicados
-- em categorias diferentes (desde que tenham parent_id diferentes)
-- Isso permite ter "Animais" tanto para "Banco de Vídeos" quanto para "Imagens"

-- 1. Remover a constraint UNIQUE atual do slug
ALTER TABLE public.categories 
DROP CONSTRAINT IF EXISTS categories_slug_key;

-- 2. Criar índices únicos parciais para garantir unicidade:
--    - Categorias principais (parent_id IS NULL) devem ter slugs únicos entre si
--    - Subcategorias do mesmo pai devem ter slugs únicos entre si
--    - Subcategorias de pais diferentes podem ter o mesmo slug

-- Índice único para categorias principais (parent_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique_main 
ON public.categories (slug) 
WHERE parent_id IS NULL;

-- Índice único composto para subcategorias (parent_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_parent_unique 
ON public.categories (slug, parent_id) 
WHERE parent_id IS NOT NULL;

-- Nota: Esta abordagem permite que:
-- - Categorias principais (parent_id = NULL) tenham slugs únicos entre si
-- - Subcategorias do mesmo pai tenham slugs únicos entre si
-- - Subcategorias de pais diferentes possam ter o mesmo slug (ex: "Animais" para "Banco de Vídeos" e "Imagens")


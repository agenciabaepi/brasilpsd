-- Reorganização completa do sistema de categorias
-- Nova estrutura: apenas categorias principais + subcategorias específicas de PSD
-- Categorias principais: PSD, MOCKUPS, VETORES, IMAGENS, AUDIOS, VIDEOS, FONTES

-- 1. Primeiro, remover todas as subcategorias existentes
-- (vamos recriar apenas as de PSD depois)
DELETE FROM public.categories WHERE parent_id IS NOT NULL;

-- 2. Remover todas as categorias principais antigas
DELETE FROM public.categories;

-- 3. Criar as novas categorias principais na ordem correta
INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
VALUES
  ('PSD', 'psd', 'Arquivos PSD editáveis do Photoshop', NULL, 1, NOW()),
  ('MOCKUPS', 'mockups', 'Mockups profissionais para apresentação de projetos', NULL, 2, NOW()),
  ('VETORES', 'vetores', 'Arquivos vetoriais (SVG, AI, EPS)', NULL, 3, NOW()),
  ('IMAGENS', 'imagens', 'Imagens de alta qualidade (IA, PNG, etc)', NULL, 4, NOW()),
  ('AUDIOS', 'audios', 'Efeitos sonoros, músicas e áudios profissionais', NULL, 5, NOW()),
  ('VIDEOS', 'videos', 'Vídeos e animações profissionais', NULL, 6, NOW()),
  ('FONTES', 'fontes', 'Fontes tipográficas para uso profissional', NULL, 7, NOW());

-- 4. Criar subcategorias específicas de PSD
DO $$
DECLARE
  psd_category_id UUID;
BEGIN
  -- Buscar ID da categoria PSD
  SELECT id INTO psd_category_id
  FROM public.categories
  WHERE slug = 'psd' AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria PSD, criar as subcategorias
  IF psd_category_id IS NOT NULL THEN
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    VALUES
      ('SELOS 3D', 'selos-3d', 'Selos e carimbos 3D em PSD', psd_category_id, 1, NOW()),
      ('SOCIAL MEDIA', 'social-media', 'Artes para redes sociais em PSD', psd_category_id, 2, NOW()),
      ('MOCKUPS', 'mockups-psd', 'Mockups em formato PSD', psd_category_id, 3, NOW()),
      ('LOGOS', 'logos', 'Logos editáveis em PSD', psd_category_id, 4, NOW()),
      ('TEXTURAS', 'texturas', 'Texturas e padrões em PSD', psd_category_id, 5, NOW()),
      ('PATTERN', 'pattern', 'Padrões e designs repetitivos em PSD', psd_category_id, 6, NOW()),
      ('SHAPES', 'shapes', 'Formas e elementos gráficos em PSD', psd_category_id, 7, NOW());

    RAISE NOTICE 'Subcategorias de PSD criadas com sucesso!';
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar a categoria PSD';
  END IF;
END $$;

-- 5. Atualizar recursos existentes para usar as novas categorias baseado no resource_type
-- Mapear resource_type para as novas categorias
UPDATE public.resources
SET category_id = (
  SELECT id FROM public.categories 
  WHERE slug = CASE 
    WHEN resource_type = 'psd' THEN 'psd'
    WHEN resource_type = 'ai' THEN 'vetores'
    WHEN resource_type = 'image' THEN 'imagens'
    WHEN resource_type = 'audio' THEN 'audios'
    WHEN resource_type = 'video' THEN 'videos'
    WHEN resource_type = 'font' THEN 'fontes'
    ELSE NULL
  END
  AND parent_id IS NULL
  LIMIT 1
)
WHERE resource_type IN ('psd', 'ai', 'image', 'audio', 'video', 'font');

-- 6. Para recursos que não têm correspondência direta, remover a categoria
-- (deixar NULL para que a busca funcione pelo título/descrição)
UPDATE public.resources
SET category_id = NULL
WHERE category_id NOT IN (SELECT id FROM public.categories);

-- 7. Atualizar order_index para garantir ordem correta
UPDATE public.categories
SET order_index = subquery.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY 
    CASE slug
      WHEN 'psd' THEN 1
      WHEN 'mockups' THEN 2
      WHEN 'vetores' THEN 3
      WHEN 'imagens' THEN 4
      WHEN 'audios' THEN 5
      WHEN 'videos' THEN 6
      WHEN 'fontes' THEN 7
      ELSE 999
    END
  ) as new_order
  FROM public.categories
  WHERE parent_id IS NULL
) AS subquery
WHERE categories.id = subquery.id AND categories.parent_id IS NULL;

-- 8. Atualizar order_index das subcategorias de PSD
UPDATE public.categories
SET order_index = subquery.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY 
    CASE slug
      WHEN 'selos-3d' THEN 1
      WHEN 'social-media' THEN 2
      WHEN 'mockups-psd' THEN 3
      WHEN 'logos' THEN 4
      WHEN 'texturas' THEN 5
      WHEN 'pattern' THEN 6
      WHEN 'shapes' THEN 7
      ELSE 999
    END
  ) as new_order
  FROM public.categories
  WHERE parent_id IN (SELECT id FROM public.categories WHERE slug = 'psd' AND parent_id IS NULL)
) AS subquery
WHERE categories.id = subquery.id;


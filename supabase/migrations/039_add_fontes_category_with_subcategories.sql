-- Criar categoria principal "Fontes" e suas subcategorias
-- Similar à estrutura de "Imagens"

-- 1. Criar categoria principal "Fontes" (se não existir)
INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
SELECT 
  'Fontes',
  'fontes',
  'Coleção completa de fontes tipográficas para uso profissional',
  NULL,
  COALESCE((SELECT MAX(order_index) FROM public.categories WHERE parent_id IS NULL), 0) + 1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'fontes' OR slug = 'fonts' OR (name = 'Fontes' AND parent_id IS NULL)
);

-- 2. Obter o ID da categoria "Fontes" e criar subcategorias
DO $$
DECLARE
  fontes_category_id UUID;
BEGIN
  -- Buscar ID da categoria Fontes
  SELECT id INTO fontes_category_id
  FROM public.categories
  WHERE (slug = 'fontes' OR slug = 'fonts' OR name = 'Fontes') AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria, criar as subcategorias
  IF fontes_category_id IS NOT NULL THEN
    -- Criar subcategorias de Fontes (uma por vez com verificação)
    
    -- Subcategoria 1: Sans Serif
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Sans Serif', 'sans-serif', 'Fontes sem serifa, modernas e limpas', fontes_category_id, 1, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'sans-serif' AND parent_id = fontes_category_id);
    
    -- Subcategoria 2: Serif
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Serif', 'serif', 'Fontes com serifa, clássicas e elegantes', fontes_category_id, 2, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'serif' AND parent_id = fontes_category_id);
    
    -- Subcategoria 3: Display
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Display', 'display', 'Fontes decorativas e chamativas para títulos', fontes_category_id, 3, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'display' AND parent_id = fontes_category_id);
    
    -- Subcategoria 4: Script
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Script', 'script', 'Fontes manuscritas e caligráficas', fontes_category_id, 4, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'script' AND parent_id = fontes_category_id);
    
    -- Subcategoria 5: Monospace
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Monospace', 'monospace', 'Fontes monoespaçadas para código e terminal', fontes_category_id, 5, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'monospace' AND parent_id = fontes_category_id);
    
    -- Subcategoria 6: Handwriting
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Handwriting', 'handwriting', 'Fontes que imitam escrita à mão', fontes_category_id, 6, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'handwriting' AND parent_id = fontes_category_id);
    
    -- Subcategoria 7: Modern
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Modern', 'modern', 'Fontes modernas e contemporâneas', fontes_category_id, 7, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'modern' AND parent_id = fontes_category_id);
    
    -- Subcategoria 8: Vintage
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Vintage', 'vintage', 'Fontes retrô e com estilo vintage', fontes_category_id, 8, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'vintage' AND parent_id = fontes_category_id);
    
    -- Subcategoria 9: Bold
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Bold', 'bold', 'Fontes em negrito e peso pesado', fontes_category_id, 9, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'bold' AND parent_id = fontes_category_id);
    
    -- Subcategoria 10: Thin
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Thin', 'thin', 'Fontes finas e leves', fontes_category_id, 10, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'thin' AND parent_id = fontes_category_id);
    
    -- Subcategoria 11: Brush
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Brush', 'brush', 'Fontes com efeito de pincel e caligrafia', fontes_category_id, 11, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'brush' AND parent_id = fontes_category_id);
    
    -- Subcategoria 12: Retro
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Retro', 'retro', 'Fontes com estilo retrô e anos 80/90', fontes_category_id, 12, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'retro' AND parent_id = fontes_category_id);
    
    -- Subcategoria 13: Futurista
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Futurista', 'futurista', 'Fontes futuristas e tecnológicas', fontes_category_id, 13, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'futurista' AND parent_id = fontes_category_id);
    
    -- Subcategoria 14: Graffiti
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Graffiti', 'graffiti', 'Fontes inspiradas em graffiti e street art', fontes_category_id, 14, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'graffiti' AND parent_id = fontes_category_id);
    
    -- Subcategoria 15: Elegante
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Elegante', 'elegante', 'Fontes elegantes e sofisticadas', fontes_category_id, 15, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'elegante' AND parent_id = fontes_category_id);
    
    -- Subcategoria 16: Comic
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Comic', 'comic', 'Fontes estilo quadrinhos e desenho animado', fontes_category_id, 16, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'comic' AND parent_id = fontes_category_id);
    
    -- Subcategoria 17: Gótica
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Gótica', 'gotica', 'Fontes góticas e medievais', fontes_category_id, 17, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'gotica' AND parent_id = fontes_category_id);
    
    -- Subcategoria 18: Arredondada
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Arredondada', 'arredondada', 'Fontes com bordas arredondadas', fontes_category_id, 18, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'arredondada' AND parent_id = fontes_category_id);
    
    -- Subcategoria 19: Condensada
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Condensada', 'condensada', 'Fontes condensadas e estreitas', fontes_category_id, 19, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'condensada' AND parent_id = fontes_category_id);
    
    -- Subcategoria 20: Decorativa
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Decorativa', 'decorativa', 'Fontes decorativas e ornamentais', fontes_category_id, 20, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'decorativa' AND parent_id = fontes_category_id);
    
    -- Subcategoria 21: Stencil
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Stencil', 'stencil', 'Fontes estilo stencil e militar', fontes_category_id, 21, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'stencil' AND parent_id = fontes_category_id);
    
    -- Subcategoria 22: Hand Lettering
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Hand Lettering', 'hand-lettering', 'Fontes de lettering manual e artístico', fontes_category_id, 22, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'hand-lettering' AND parent_id = fontes_category_id);
    
    -- Subcategoria 23: Minimalista
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Minimalista', 'minimalista', 'Fontes minimalistas e simples', fontes_category_id, 23, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'minimalista' AND parent_id = fontes_category_id);
    
    -- Subcategoria 24: Bold & Heavy
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Bold & Heavy', 'bold-heavy', 'Fontes em negrito e peso pesado', fontes_category_id, 24, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'bold-heavy' AND parent_id = fontes_category_id);
    
    -- Subcategoria 25: Italic
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Italic', 'italic', 'Fontes em itálico e inclinadas', fontes_category_id, 25, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'italic' AND parent_id = fontes_category_id);

    RAISE NOTICE 'Categoria "Fontes" e 25 subcategorias criadas com sucesso!';
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar ou criar a categoria "Fontes"';
  END IF;
END $$;

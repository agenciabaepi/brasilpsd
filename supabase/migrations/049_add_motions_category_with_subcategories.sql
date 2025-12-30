-- Criar categoria principal "Motions" e suas subcategorias
-- Similar à estrutura de "Imagens", "Fontes" e "Áudios"

-- 1. Criar categoria principal "Motions" (se não existir)
INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
SELECT 
  'Motions',
  'motions',
  'Projetos de After Effects e Premiere para uso profissional',
  NULL,
  COALESCE((SELECT MAX(order_index) FROM public.categories WHERE parent_id IS NULL), 0) + 1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'motions' OR slug = 'motion' OR (name = 'Motions' AND parent_id IS NULL)
);

-- 2. Obter o ID da categoria "Motions" e criar subcategorias
DO $$
DECLARE
  motions_category_id UUID;
BEGIN
  -- Buscar ID da categoria Motions
  SELECT id INTO motions_category_id
  FROM public.categories
  WHERE (slug = 'motions' OR slug = 'motion' OR name = 'Motions') AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria, criar as subcategorias
  IF motions_category_id IS NOT NULL THEN
    -- Criar subcategorias de Motions (uma por vez com verificação)
    
    -- Subcategoria 1: Transições
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Transições', 'transicoes-motion', 'Transições e cortes para vídeos', motions_category_id, 1, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'transicoes-motion' AND parent_id = motions_category_id);
    
    -- Subcategoria 2: Títulos
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Títulos', 'titulos-motion', 'Animações de títulos e textos', motions_category_id, 2, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'titulos-motion' AND parent_id = motions_category_id);
    
    -- Subcategoria 3: Lower Thirds
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Lower Thirds', 'lower-thirds', 'Lower thirds e identificadores', motions_category_id, 3, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'lower-thirds' AND parent_id = motions_category_id);
    
    -- Subcategoria 4: Logo Animations
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Logo Animations', 'logo-animations', 'Animações de logos e identidades', motions_category_id, 4, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'logo-animations' AND parent_id = motions_category_id);
    
    -- Subcategoria 5: Intros
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Intros', 'intros', 'Introduções e aberturas animadas', motions_category_id, 5, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'intros' AND parent_id = motions_category_id);
    
    -- Subcategoria 6: Outros
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Outros', 'outros', 'Outros elementos de motion', motions_category_id, 6, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'outros' AND parent_id = motions_category_id);
    
    -- Subcategoria 7: Cinemático
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Cinemático', 'cinematico', 'Efeitos e transições cinematográficas', motions_category_id, 7, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'cinematico' AND parent_id = motions_category_id);
    
    -- Subcategoria 8: Social Media
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Social Media', 'social-media', 'Templates para redes sociais', motions_category_id, 8, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'social-media' AND parent_id = motions_category_id);
    
    -- Subcategoria 9: Glitch
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Glitch', 'glitch', 'Efeitos glitch e distorções', motions_category_id, 9, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'glitch' AND parent_id = motions_category_id);
    
    -- Subcategoria 10: Particles
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Particles', 'particles', 'Efeitos de partículas e fumaça', motions_category_id, 10, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'particles' AND parent_id = motions_category_id);
    
    -- Subcategoria 11: Typography
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Typography', 'typography', 'Animações tipográficas', motions_category_id, 11, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'typography' AND parent_id = motions_category_id);
    
    -- Subcategoria 12: Sci-Fi
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Sci-Fi', 'sci-fi-motion', 'Efeitos de ficção científica', motions_category_id, 12, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'sci-fi-motion' AND parent_id = motions_category_id);
    
    -- Subcategoria 13: HUD
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'HUD', 'hud', 'Interfaces HUD e elementos de UI', motions_category_id, 13, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'hud' AND parent_id = motions_category_id);
    
    -- Subcategoria 14: Explosions
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Explosions', 'explosions', 'Efeitos de explosão e impacto', motions_category_id, 14, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'explosions' AND parent_id = motions_category_id);
    
    -- Subcategoria 15: Light Leaks
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Light Leaks', 'light-leaks', 'Vazamentos de luz e flares', motions_category_id, 15, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'light-leaks' AND parent_id = motions_category_id);
    
    -- Subcategoria 16: Color Grading
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Color Grading', 'color-grading', 'Presets de color grading', motions_category_id, 16, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'color-grading' AND parent_id = motions_category_id);
    
    -- Subcategoria 17: VHS
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'VHS', 'vhs', 'Efeitos VHS e retro', motions_category_id, 17, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'vhs' AND parent_id = motions_category_id);
    
    -- Subcategoria 18: Minimalist
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Minimalist', 'minimalist', 'Animações minimalistas', motions_category_id, 18, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'minimalist' AND parent_id = motions_category_id);
    
    -- Subcategoria 19: Corporate
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Corporate', 'corporate', 'Templates corporativos', motions_category_id, 19, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'corporate' AND parent_id = motions_category_id);
    
    -- Subcategoria 20: Music Visualizer
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Music Visualizer', 'music-visualizer', 'Visualizadores de música', motions_category_id, 20, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'music-visualizer' AND parent_id = motions_category_id);

    RAISE NOTICE 'Categoria "Motions" e 20 subcategorias criadas com sucesso!';
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar ou criar a categoria "Motions"';
  END IF;
END $$;


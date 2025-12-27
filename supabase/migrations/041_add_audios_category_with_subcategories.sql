-- Criar categoria principal "Áudios" e suas subcategorias
-- Similar à estrutura de "Imagens" e "Fontes"

-- 1. Criar categoria principal "Áudios" (se não existir)
INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
SELECT 
  'Áudios',
  'audios',
  'Coleção completa de efeitos sonoros, músicas e áudios para uso profissional',
  NULL,
  COALESCE((SELECT MAX(order_index) FROM public.categories WHERE parent_id IS NULL), 0) + 1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'audios' OR slug = 'áudios' OR slug = 'audio' OR (name = 'Áudios' AND parent_id IS NULL)
);

-- 2. Obter o ID da categoria "Áudios" e criar subcategorias
DO $$
DECLARE
  audios_category_id UUID;
BEGIN
  -- Buscar ID da categoria Áudios
  SELECT id INTO audios_category_id
  FROM public.categories
  WHERE (slug = 'audios' OR slug = 'áudios' OR slug = 'audio' OR name = 'Áudios') AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria, criar as subcategorias
  IF audios_category_id IS NOT NULL THEN
    -- Criar subcategorias de Áudios (uma por vez com verificação)
    
    -- Subcategoria 1: Efeitos Sonoros
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Efeitos Sonoros', 'efeitos-sonoros', 'Efeitos sonoros diversos para projetos', audios_category_id, 1, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'efeitos-sonoros' AND parent_id = audios_category_id);
    
    -- Subcategoria 2: Música
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Música', 'musica', 'Músicas e trilhas sonoras', audios_category_id, 2, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'musica' AND parent_id = audios_category_id);
    
    -- Subcategoria 3: Transições
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Transições', 'transicoes', 'Sons de transição e cortes', audios_category_id, 3, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'transicoes' AND parent_id = audios_category_id);
    
    -- Subcategoria 4: Ambiente
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Ambiente', 'ambiente', 'Sons ambiente e atmosféricos', audios_category_id, 4, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'ambiente' AND parent_id = audios_category_id);
    
    -- Subcategoria 5: UI/Interface
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'UI/Interface', 'ui-interface', 'Sons para interfaces e aplicativos', audios_category_id, 5, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'ui-interface' AND parent_id = audios_category_id);
    
    -- Subcategoria 6: Notificações
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Notificações', 'notificacoes', 'Sons de notificação e alertas', audios_category_id, 6, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'notificacoes' AND parent_id = audios_category_id);
    
    -- Subcategoria 7: Natureza
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Natureza', 'natureza', 'Sons da natureza e animais', audios_category_id, 7, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'natureza' AND parent_id = audios_category_id);
    
    -- Subcategoria 8: Veículos
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Veículos', 'veiculos', 'Sons de veículos e transporte', audios_category_id, 8, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'veiculos' AND parent_id = audios_category_id);
    
    -- Subcategoria 9: Humanos
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Humanos', 'humanos', 'Sons humanos, vozes e respiração', audios_category_id, 9, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'humanos' AND parent_id = audios_category_id);
    
    -- Subcategoria 10: Tecnologia
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Tecnologia', 'tecnologia', 'Sons tecnológicos e futuristas', audios_category_id, 10, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'tecnologia' AND parent_id = audios_category_id);
    
    -- Subcategoria 11: Ação
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Ação', 'acao', 'Sons de ação e impacto', audios_category_id, 11, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'acao' AND parent_id = audios_category_id);
    
    -- Subcategoria 12: Comédia
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Comédia', 'comedia', 'Sons cômicos e engraçados', audios_category_id, 12, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'comedia' AND parent_id = audios_category_id);
    
    -- Subcategoria 13: Suspense
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Suspense', 'suspense', 'Sons de suspense e tensão', audios_category_id, 13, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'suspense' AND parent_id = audios_category_id);
    
    -- Subcategoria 14: Sci-Fi
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Sci-Fi', 'sci-fi', 'Sons de ficção científica', audios_category_id, 14, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'sci-fi' AND parent_id = audios_category_id);
    
    -- Subcategoria 15: Horror
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Horror', 'horror', 'Sons de terror e horror', audios_category_id, 15, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'horror' AND parent_id = audios_category_id);
    
    -- Subcategoria 16: Fantasia
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Fantasia', 'fantasia', 'Sons mágicos e de fantasia', audios_category_id, 16, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'fantasia' AND parent_id = audios_category_id);
    
    -- Subcategoria 17: Retro
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Retro', 'retro', 'Sons retrô e vintage', audios_category_id, 17, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'retro' AND parent_id = audios_category_id);
    
    -- Subcategoria 18: Urbano
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Urbano', 'urbano', 'Sons urbanos e da cidade', audios_category_id, 18, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'urbano' AND parent_id = audios_category_id);
    
    -- Subcategoria 19: Industrial
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Industrial', 'industrial', 'Sons industriais e mecânicos', audios_category_id, 19, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'industrial' AND parent_id = audios_category_id);
    
    -- Subcategoria 20: Música Eletrônica
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Música Eletrônica', 'musica-eletronica', 'Músicas e loops eletrônicos', audios_category_id, 20, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'musica-eletronica' AND parent_id = audios_category_id);
    
    -- Subcategoria 21: Música Acústica
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Música Acústica', 'musica-acustica', 'Músicas acústicas e instrumentais', audios_category_id, 21, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'musica-acustica' AND parent_id = audios_category_id);
    
    -- Subcategoria 22: Loops
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Loops', 'loops', 'Loops musicais e sonoros', audios_category_id, 22, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'loops' AND parent_id = audios_category_id);
    
    -- Subcategoria 23: Jingle
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Jingle', 'jingle', 'Jingles e identidades sonoras', audios_category_id, 23, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'jingle' AND parent_id = audios_category_id);
    
    -- Subcategoria 24: Logo Sonoro
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Logo Sonoro', 'logo-sonoro', 'Logos sonoros e identidades de marca', audios_category_id, 24, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'logo-sonoro' AND parent_id = audios_category_id);
    
    -- Subcategoria 25: Introdução
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Introdução', 'introducao', 'Sons de introdução e abertura', audios_category_id, 25, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'introducao' AND parent_id = audios_category_id);

    RAISE NOTICE 'Categoria "Áudios" e 25 subcategorias criadas com sucesso!';
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar ou criar a categoria "Áudios"';
  END IF;
END $$;



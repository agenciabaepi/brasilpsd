-- Adicionar novas subcategorias de áudio baseadas na imagem fornecida
-- Esta migração cria a categoria principal "Áudios" se não existir e adiciona as subcategorias

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

DO $$
DECLARE
  audios_category_id UUID;
  current_max_order INTEGER;
BEGIN
  -- Buscar ID da categoria Áudios
  SELECT id INTO audios_category_id
  FROM public.categories
  WHERE (slug = 'audios' OR slug = 'áudios' OR slug = 'audio' OR name = 'Áudios') AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria, criar as novas subcategorias
  IF audios_category_id IS NOT NULL THEN
    -- Obter o maior order_index atual para continuar a numeração
    SELECT COALESCE(MAX(order_index), 0) INTO current_max_order
    FROM public.categories
    WHERE parent_id = audios_category_id;

    -- Coluna 1 da imagem
    -- Logos e Identidades
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Logos e Identidades', 'logos-e-identidades', 'Logos sonoros e identidades de marca', audios_category_id, current_max_order + 1, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'logos-e-identidades' AND parent_id = audios_category_id);
    
    -- Plano de Fundo
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Plano de Fundo', 'plano-de-fundo', 'Músicas e sons de fundo para projetos', audios_category_id, current_max_order + 2, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'plano-de-fundo' AND parent_id = audios_category_id);
    
    -- Épica/Poderosa
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Épica/Poderosa', 'epica-poderosa', 'Músicas épicas e poderosas', audios_category_id, current_max_order + 3, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'epica-poderosa' AND parent_id = audios_category_id);
    
    -- Animada/Energética
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Animada/Energética', 'animada-energetica', 'Músicas animadas e energéticas', audios_category_id, current_max_order + 4, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'animada-energetica' AND parent_id = audios_category_id);
    
    -- Corporativo
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Corporativo', 'corporativo', 'Músicas e sons corporativos profissionais', audios_category_id, current_max_order + 5, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'corporativo' AND parent_id = audios_category_id);
    
    -- Feliz/Alegre
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Feliz/Alegre', 'feliz-alegre', 'Músicas felizes e alegres', audios_category_id, current_max_order + 6, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'feliz-alegre' AND parent_id = audios_category_id);
    
    -- Rock
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Rock', 'rock', 'Músicas e sons de rock', audios_category_id, current_max_order + 7, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'rock' AND parent_id = audios_category_id);
    
    -- Funk
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Funk', 'funk', 'Músicas e sons de funk', audios_category_id, current_max_order + 8, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'funk' AND parent_id = audios_category_id);

    -- Coluna 2 da imagem
    -- Jogos
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Jogos', 'jogos', 'Sons e músicas para jogos', audios_category_id, current_max_order + 9, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'jogos' AND parent_id = audios_category_id);
    
    -- Transições e movimento
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Transições e movimento', 'transicoes-e-movimento', 'Sons de transição e movimento', audios_category_id, current_max_order + 10, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'transicoes-e-movimento' AND parent_id = audios_category_id);
    
    -- Doméstico
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Doméstico', 'domestico', 'Sons domésticos e do lar', audios_category_id, current_max_order + 11, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'domestico' AND parent_id = audios_category_id);
    
    -- Humano (diferente de Humanos)
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Humano', 'humano', 'Sons humanos e vozes', audios_category_id, current_max_order + 12, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'humano' AND parent_id = audios_category_id);
    
    -- Futurístico
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Futurístico', 'futuristico', 'Sons futurísticos e sci-fi', audios_category_id, current_max_order + 13, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'futuristico' AND parent_id = audios_category_id);
    
    -- Interface (diferente de UI/Interface)
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Interface', 'interface', 'Sons de interface e UI', audios_category_id, current_max_order + 14, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'interface' AND parent_id = audios_category_id);

    -- Coluna 3 da imagem
    -- Superação
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Superação', 'superacao', 'Músicas de superação e conquista', audios_category_id, current_max_order + 15, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'superacao' AND parent_id = audios_category_id);
    
    -- Motivacional
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Motivacional', 'motivacional', 'Músicas motivacionais e inspiradoras', audios_category_id, current_max_order + 16, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'motivacional' AND parent_id = audios_category_id);
    
    -- Solo de Guitarra
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Solo de Guitarra', 'solo-de-guitarra', 'Solos de guitarra e instrumentais', audios_category_id, current_max_order + 17, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'solo-de-guitarra' AND parent_id = audios_category_id);
    
    -- Trilha Sonora do Esporte
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Trilha Sonora do Esporte', 'trilha-sonora-do-esporte', 'Músicas e sons para esportes', audios_category_id, current_max_order + 18, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'trilha-sonora-do-esporte' AND parent_id = audios_category_id);
    
    -- Romântico
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Romântico', 'romantico', 'Músicas românticas e suaves', audios_category_id, current_max_order + 19, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'romantico' AND parent_id = audios_category_id);
    
    -- Música Infantil
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Música Infantil', 'musica-infantil', 'Músicas e sons para crianças', audios_category_id, current_max_order + 20, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'musica-infantil' AND parent_id = audios_category_id);
    
    -- Vinheta (diferente de Jingle)
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Vinheta', 'vinheta', 'Vinhetas e identidades sonoras curtas', audios_category_id, current_max_order + 21, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'vinheta' AND parent_id = audios_category_id);
    
    -- Grito de Guerra
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    SELECT 'Grito de Guerra', 'grito-de-guerra', 'Gritos de guerra e batalha', audios_category_id, current_max_order + 22, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'grito-de-guerra' AND parent_id = audios_category_id);

    RAISE NOTICE 'Novas subcategorias de áudio adicionadas com sucesso!';
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar a categoria "Áudios"';
  END IF;
END $$;


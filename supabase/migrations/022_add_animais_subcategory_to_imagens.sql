-- Adicionar subcategoria "Animais" para a categoria "Imagens"
-- Esta subcategoria pode coexistir com "Animais" de "Banco de Vídeos"
-- graças à correção na constraint UNIQUE do slug

DO $$
DECLARE
  imagens_category_id UUID;
  existing_animais_id UUID;
BEGIN
  -- Buscar ID da categoria "Imagens" (categoria principal)
  SELECT id INTO imagens_category_id
  FROM public.categories
  WHERE (slug = 'imagens' OR name = 'Imagens') AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria Imagens
  IF imagens_category_id IS NOT NULL THEN
    -- Verificar se já existe "Animais" como subcategoria de Imagens
    SELECT id INTO existing_animais_id
    FROM public.categories
    WHERE (slug = 'animais' OR name = 'Animais') 
      AND parent_id = imagens_category_id
    LIMIT 1;

    -- Se não existe, criar a subcategoria "Animais"
    IF existing_animais_id IS NULL THEN
      -- Obter o maior order_index das subcategorias de Imagens
      INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
      VALUES (
        'Animais',
        'animais',
        'Imagens de animais domésticos, selvagens, pássaros e vida animal',
        imagens_category_id,
        COALESCE(
          (SELECT MAX(order_index) FROM public.categories WHERE parent_id = imagens_category_id), 
          0
        ) + 1,
        NOW()
      );

      RAISE NOTICE 'Subcategoria "Animais" criada com sucesso para "Imagens"!';
    ELSE
      RAISE NOTICE 'Subcategoria "Animais" já existe para "Imagens"';
    END IF;
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar a categoria "Imagens"';
  END IF;
END $$;


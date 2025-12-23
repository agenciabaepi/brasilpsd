-- Criar categoria principal "Imagens" e suas 10 subcategorias
-- Similar à estrutura de "Banco de Vídeos"

-- 1. Criar categoria principal "Imagens" (se não existir)
INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
SELECT 
  'Imagens',
  'imagens',
  'Coleção completa de imagens de alta qualidade para uso profissional',
  NULL,
  COALESCE((SELECT MAX(order_index) FROM public.categories WHERE parent_id IS NULL), 0) + 1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'imagens' OR (name = 'Imagens' AND parent_id IS NULL)
);

-- 2. Obter o ID da categoria "Imagens"
DO $$
DECLARE
  imagens_category_id UUID;
BEGIN
  -- Buscar ID da categoria Imagens
  SELECT id INTO imagens_category_id
  FROM public.categories
  WHERE (slug = 'imagens' OR name = 'Imagens') AND parent_id IS NULL
  LIMIT 1;

  -- Se encontrou a categoria, criar as subcategorias
  IF imagens_category_id IS NOT NULL THEN
    -- 3. Criar 10 subcategorias de Imagens
    INSERT INTO public.categories (name, slug, description, parent_id, order_index, created_at)
    VALUES
      -- Subcategoria 1: Pessoas
      (
        'Pessoas',
        'pessoas',
        'Imagens de pessoas, retratos, grupos e interações humanas',
        imagens_category_id,
        1,
        NOW()
      ),
      -- Subcategoria 2: Natureza
      (
        'Natureza',
        'natureza',
        'Paisagens naturais, animais, plantas e ambientes ao ar livre',
        imagens_category_id,
        2,
        NOW()
      ),
      -- Subcategoria 3: Negócios
      (
        'Negócios',
        'negocios',
        'Imagens corporativas, escritórios, reuniões e ambiente de trabalho',
        imagens_category_id,
        3,
        NOW()
      ),
      -- Subcategoria 4: Tecnologia
      (
        'Tecnologia',
        'tecnologia',
        'Dispositivos eletrônicos, computadores, smartphones e inovação',
        imagens_category_id,
        4,
        NOW()
      ),
      -- Subcategoria 5: Comida & Bebida
      (
        'Comida & Bebida',
        'comida-bebida',
        'Pratos, ingredientes, restaurantes e gastronomia',
        imagens_category_id,
        5,
        NOW()
      ),
      -- Subcategoria 6: Viagem & Turismo
      (
        'Viagem & Turismo',
        'viagem-turismo',
        'Destinos, hotéis, pontos turísticos e experiências de viagem',
        imagens_category_id,
        6,
        NOW()
      ),
      -- Subcategoria 7: Esportes & Fitness
      (
        'Esportes & Fitness',
        'esportes-fitness',
        'Atividades esportivas, exercícios e estilo de vida saudável',
        imagens_category_id,
        7,
        NOW()
      ),
      -- Subcategoria 8: Arquitetura & Interiores
      (
        'Arquitetura & Interiores',
        'arquitetura-interiores',
        'Edifícios, design de interiores, decoração e espaços',
        imagens_category_id,
        8,
        NOW()
      ),
      -- Subcategoria 9: Abstrato & Artístico
      (
        'Abstrato & Artístico',
        'abstrato-artistico',
        'Arte abstrata, padrões, texturas e composições criativas',
        imagens_category_id,
        9,
        NOW()
      ),
      -- Subcategoria 10: Religiosidade
      (
        'Religiosidade',
        'religiosidade',
        'Imagens religiosas, espiritualidade, símbolos sagrados e cerimônias',
        imagens_category_id,
        10,
        NOW()
      )
    ON CONFLICT (slug) DO NOTHING;

    RAISE NOTICE 'Categoria "Imagens" e 10 subcategorias criadas com sucesso!';
  ELSE
    RAISE NOTICE 'Erro: Não foi possível encontrar ou criar a categoria "Imagens"';
  END IF;
END $$;


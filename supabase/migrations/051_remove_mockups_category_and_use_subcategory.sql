-- Remover categoria MOCKUPS principal e usar apenas a subcategoria de PSD
-- Esta migração move recursos da categoria Mockups principal para a subcategoria mockups-psd de PSD

-- 1. Buscar IDs das categorias
DO $$
DECLARE
  mockups_main_id UUID;
  mockups_psd_sub_id UUID;
  psd_category_id UUID;
  resources_moved_count INTEGER := 0;
BEGIN
  -- Buscar categoria Mockups principal
  SELECT id INTO mockups_main_id
  FROM public.categories
  WHERE slug = 'mockups' AND parent_id IS NULL
  LIMIT 1;

  -- Buscar categoria PSD
  SELECT id INTO psd_category_id
  FROM public.categories
  WHERE slug = 'psd' AND parent_id IS NULL
  LIMIT 1;

  -- Buscar subcategoria mockups-psd de PSD
  SELECT id INTO mockups_psd_sub_id
  FROM public.categories
  WHERE slug = 'mockups-psd' AND parent_id = psd_category_id
  LIMIT 1;

  -- Se encontrou a categoria Mockups principal
  IF mockups_main_id IS NOT NULL THEN
    -- Se encontrou a subcategoria mockups-psd, mover recursos
    IF mockups_psd_sub_id IS NOT NULL THEN
      -- Mover recursos da categoria Mockups principal para a subcategoria mockups-psd
      UPDATE public.resources
      SET category_id = mockups_psd_sub_id
      WHERE category_id = mockups_main_id;

      GET DIAGNOSTICS resources_moved_count = ROW_COUNT;
      RAISE NOTICE '✅ % recursos movidos da categoria Mockups principal para a subcategoria mockups-psd', resources_moved_count;

      -- Atualizar resource_categories se existir
      UPDATE public.resource_categories
      SET category_id = mockups_psd_sub_id
      WHERE category_id = mockups_main_id;

      RAISE NOTICE '✅ Referências em resource_categories atualizadas';
    ELSE
      RAISE WARNING '⚠️ Subcategoria mockups-psd não encontrada. Verifique se ela existe na categoria PSD.';
      RAISE NOTICE 'ℹ️ Recursos da categoria Mockups principal não foram movidos. Execute manualmente se necessário.';
    END IF;

    -- Excluir a categoria Mockups principal
    DELETE FROM public.categories
    WHERE id = mockups_main_id;

    RAISE NOTICE '✅ Categoria Mockups principal excluída com sucesso';
  ELSE
    RAISE NOTICE 'ℹ️ Categoria Mockups principal não encontrada (pode já ter sido excluída)';
  END IF;
END $$;

-- 2. Verificar se há recursos órfãos (sem categoria ou com categoria inválida)
-- Atualizar recursos que possam ter ficado sem categoria
UPDATE public.resources
SET category_id = (
  SELECT id FROM public.categories
  WHERE slug = 'mockups-psd'
  AND parent_id IN (SELECT id FROM public.categories WHERE slug = 'psd' AND parent_id IS NULL)
  LIMIT 1
)
WHERE category_id IS NULL
AND resource_type = 'psd'
AND (title ILIKE '%mockup%' OR description ILIKE '%mockup%');

-- 3. Atualizar order_index das categorias principais (remover gap deixado pela exclusão)
UPDATE public.categories
SET order_index = subquery.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY 
    CASE slug
      WHEN 'psd' THEN 1
      WHEN 'vetores' THEN 2
      WHEN 'imagens' THEN 3
      WHEN 'audios' THEN 4
      WHEN 'videos' THEN 5
      WHEN 'fontes' THEN 6
      ELSE 999
    END
  ) as new_order
  FROM public.categories
  WHERE parent_id IS NULL
) AS subquery
WHERE categories.id = subquery.id AND categories.parent_id IS NULL;

-- 4. Verificar resultado final
DO $$
DECLARE
  remaining_mockups_main INTEGER;
  mockups_psd_count INTEGER;
BEGIN
  -- Verificar se ainda existe categoria Mockups principal
  SELECT COUNT(*) INTO remaining_mockups_main
  FROM public.categories
  WHERE slug = 'mockups' AND parent_id IS NULL;

  -- Contar recursos na subcategoria mockups-psd
  SELECT COUNT(*) INTO mockups_psd_count
  FROM public.resources
  WHERE category_id IN (
    SELECT id FROM public.categories
    WHERE slug = 'mockups-psd'
    AND parent_id IN (SELECT id FROM public.categories WHERE slug = 'psd' AND parent_id IS NULL)
  );

  IF remaining_mockups_main = 0 THEN
    RAISE NOTICE '✅ Migração concluída com sucesso!';
    RAISE NOTICE '✅ % recursos na subcategoria mockups-psd', mockups_psd_count;
  ELSE
    RAISE WARNING '⚠️ Ainda existe categoria Mockups principal. Verifique manualmente.';
  END IF;
END $$;


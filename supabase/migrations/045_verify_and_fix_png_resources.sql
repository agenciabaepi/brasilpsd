-- Script para verificar e corrigir recursos PNG
-- IMPORTANTE: Execute PRIMEIRO a migração 046_add_png_enum_value.sql
-- para adicionar 'png' ao enum ANTES de criar as funções

-- 1. Garantir que a função de UPDATE existe e está correta
-- (Só funciona se 'png' já estiver no enum e commitado)
CREATE OR REPLACE FUNCTION public.update_resource_type_to_png(resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.resources
  SET resource_type = 'png'::resource_type
  WHERE id = resource_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource with id % not found', resource_id;
  END IF;
END;
$$;

-- 2. Função helper para atualizar múltiplos recursos
-- (Usa CAST explícito para evitar problemas de enum)
CREATE OR REPLACE FUNCTION public.fix_png_resources()
RETURNS TABLE(
  updated_count integer,
  fixed_resources jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_resources jsonb;
  v_png_type resource_type;
BEGIN
  -- Fazer cast explícito para evitar erro de enum não commitado
  v_png_type := 'png'::resource_type;
  
  -- Atualizar todos os recursos que deveriam ser PNG
  UPDATE public.resources
  SET resource_type = v_png_type
  WHERE (
    file_format ILIKE '%png%' 
    OR file_url ILIKE '%.png%'
    OR file_url ILIKE '%.PNG%'
  )
  AND resource_type::text != 'png';  -- Comparar como texto para evitar erro
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Retornar lista de recursos corrigidos
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'file_format', file_format
    )
  )
  INTO v_resources
  FROM public.resources
  WHERE resource_type::text = 'png'  -- Comparar como texto
  AND (
    file_format ILIKE '%png%' 
    OR file_url ILIKE '%.png%'
    OR file_url ILIKE '%.PNG%'
  );
  
  RETURN QUERY SELECT v_count, COALESCE(v_resources, '[]'::jsonb);
END;
$$;

-- 3. Comentários informativos
COMMENT ON FUNCTION public.update_resource_type_to_png IS 'Atualiza o resource_type de um recurso para "png"';
COMMENT ON FUNCTION public.fix_png_resources IS 'Corrige todos os recursos que deveriam ser PNG mas estão marcados como outro tipo';


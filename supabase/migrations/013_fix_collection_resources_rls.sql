-- Ajustar políticas RLS para collection_resources
-- Garantir que usuários anônimos possam ver recursos de coleções aprovadas

-- Remover política antiga se existir (pode ter nome diferente dependendo da versão)
DROP POLICY IF EXISTS "Users can view collection resources" ON public.collection_resources;
DROP POLICY IF EXISTS "Anyone can view collection resources from approved collections" ON public.collection_resources;

-- Criar política mais explícita que permite acesso público a coleções aprovadas
-- Esta política permite que qualquer pessoa veja recursos de coleções aprovadas,
-- e criadores vejam recursos de suas próprias coleções (mesmo que não estejam aprovadas)
CREATE POLICY "Anyone can view collection resources from approved collections" 
ON public.collection_resources
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.collections 
    WHERE id = collection_resources.collection_id 
    AND (
      status = 'approved' 
      OR (auth.uid() IS NOT NULL AND creator_id = auth.uid())
    )
  )
);

-- Comentário explicativo
COMMENT ON POLICY "Anyone can view collection resources from approved collections" ON public.collection_resources 
IS 'Permite que qualquer pessoa (incluindo usuários anônimos) veja recursos de coleções aprovadas, e criadores vejam recursos de suas próprias coleções';


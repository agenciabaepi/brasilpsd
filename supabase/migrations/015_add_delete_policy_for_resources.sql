-- Adicionar política RLS para admins deletarem recursos
-- Isso permite que admins deletem qualquer recurso através do cliente normal (não apenas service role)

CREATE POLICY "Admins can delete any resource"
  ON public.resources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Também permitir que criadores deletem seus próprios recursos
CREATE POLICY "Creators can delete own resources"
  ON public.resources FOR DELETE
  USING (auth.uid() = creator_id);


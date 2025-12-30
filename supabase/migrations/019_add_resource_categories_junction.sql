-- Tabela de relacionamento para múltiplas categorias por recurso
CREATE TABLE IF NOT EXISTS public.resource_categories (
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (resource_id, category_id)
);

-- Índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_resource_categories_resource ON public.resource_categories(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_categories_category ON public.resource_categories(category_id);

-- RLS Policies
CREATE POLICY "Anyone can view resource categories"
  ON public.resource_categories FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage resource categories for own resources"
  ON public.resource_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.resources
      WHERE id = resource_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage any resource categories"
  ON public.resource_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );






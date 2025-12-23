-- Sistema de Coleções
-- Permite que criadores organizem recursos em coleções

-- Tabela de coleções
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT, -- URL da imagem de capa da coleção
  slug TEXT NOT NULL, -- URL amigável
  is_featured BOOLEAN DEFAULT false, -- Para destacar coleções
  status resource_status DEFAULT 'pending' NOT NULL, -- pending, approved, rejected
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id, slug)
);

-- Tabela de relacionamento coleções-recursos
CREATE TABLE IF NOT EXISTS public.collection_resources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  order_index INTEGER DEFAULT 0, -- Ordem dos recursos na coleção
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, resource_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_collections_creator_id ON public.collections(creator_id);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON public.collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_status ON public.collections(status);
CREATE INDEX IF NOT EXISTS idx_collection_resources_collection_id ON public.collection_resources(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_resources_resource_id ON public.collection_resources(resource_id);

-- RLS para coleções
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Criadores podem ver suas próprias coleções e todas as aprovadas
CREATE POLICY "Users can view approved collections" ON public.collections
  FOR SELECT USING (status = 'approved' OR creator_id = auth.uid());

-- Criadores podem criar suas próprias coleções
CREATE POLICY "Creators can create collections" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_creator = true
  ));

-- Criadores podem atualizar suas próprias coleções
CREATE POLICY "Creators can update their collections" ON public.collections
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Criadores podem deletar suas próprias coleções
CREATE POLICY "Creators can delete their collections" ON public.collections
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- Admins podem fazer tudo
CREATE POLICY "Admins can manage all collections" ON public.collections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- RLS para collection_resources
ALTER TABLE public.collection_resources ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver recursos de coleções aprovadas
CREATE POLICY "Users can view collection resources" ON public.collection_resources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.collections 
      WHERE id = collection_id 
      AND (status = 'approved' OR creator_id = auth.uid())
    )
  );

-- Criadores podem adicionar recursos às suas coleções
CREATE POLICY "Creators can add resources to their collections" ON public.collection_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections 
      WHERE id = collection_id 
      AND creator_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.resources 
      WHERE id = resource_id 
      AND creator_id = auth.uid()
    )
  );

-- Criadores podem remover recursos de suas coleções
CREATE POLICY "Creators can remove resources from their collections" ON public.collection_resources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections 
      WHERE id = collection_id 
      AND creator_id = auth.uid()
    )
  );

-- Admins podem gerenciar tudo
CREATE POLICY "Admins can manage collection resources" ON public.collection_resources
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collections_updated_at();

-- Comentários
COMMENT ON TABLE public.collections IS 'Coleções de recursos criadas por criadores';
COMMENT ON TABLE public.collection_resources IS 'Relacionamento entre coleções e recursos';
COMMENT ON COLUMN public.collections.slug IS 'URL amigável da coleção, única por criador';






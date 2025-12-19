-- Tabela de seguidores (followers)
CREATE TABLE IF NOT EXISTS public.followers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, creator_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_followers_follower ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator ON public.followers(creator_id);

-- RLS Policies
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ver seguidores
CREATE POLICY "Anyone can view followers" ON public.followers
  FOR SELECT USING (true);

-- Usuários autenticados podem seguir
CREATE POLICY "Authenticated users can follow" ON public.followers
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Usuários podem deixar de seguir
CREATE POLICY "Users can unfollow" ON public.followers
  FOR DELETE USING (auth.uid() = follower_id);

COMMENT ON TABLE public.followers IS 'Relação de seguidores e criadores';


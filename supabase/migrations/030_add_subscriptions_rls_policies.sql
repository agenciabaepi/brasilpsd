-- Adicionar políticas RLS para a tabela subscriptions
-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Usuários podem ver suas próprias assinaturas
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins podem ver todas as assinaturas
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Política para INSERT: Usuários podem criar suas próprias assinaturas
-- (necessário para webhooks e processos automáticos)
CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Sistema/Admin pode criar assinaturas para qualquer usuário
CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Política para UPDATE: Usuários podem atualizar suas próprias assinaturas
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins podem atualizar todas as assinaturas
CREATE POLICY "Admins can update all subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );


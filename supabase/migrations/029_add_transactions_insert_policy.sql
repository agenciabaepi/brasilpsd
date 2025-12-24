-- Adicionar política RLS para permitir inserção de transações
-- Usuários podem criar suas próprias transações
CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Sistema/Admin pode criar transações para qualquer usuário
-- (necessário para webhooks e processos automáticos)
CREATE POLICY "System can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
    OR
    -- Permitir inserção se o user_id corresponde ao usuário autenticado
    auth.uid() = user_id
  );

-- Adicionar política para UPDATE (usuários podem atualizar suas próprias transações)
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins podem atualizar todas as transações
CREATE POLICY "Admins can update all transactions"
  ON public.transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );


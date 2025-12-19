-- Atualizar recursos oficiais existentes para usar o perfil do sistema
-- Este script atualiza todos os recursos marcados como oficiais para apontar para o perfil do sistema

DO $$
DECLARE
  system_user_id uuid;
  system_email TEXT := 'sistema@brasilpsd.com.br';
BEGIN
  -- Buscar o UUID do usuário pelo email
  SELECT id INTO system_user_id
  FROM auth.users
  WHERE email = system_email
  LIMIT 1;

  -- Se não encontrou, buscar pelo perfil
  IF system_user_id IS NULL THEN
    SELECT id INTO system_user_id
    FROM public.profiles
    WHERE email = system_email
    LIMIT 1;
  END IF;

  -- Se ainda não encontrou, usar UUID do sistema
  IF system_user_id IS NULL THEN
    system_user_id := '4fcdbfce-ea01-4a86-ad02-ec24dc6f3758'::uuid;
    RAISE NOTICE 'Perfil do sistema não encontrado. Usando UUID do sistema: %', system_user_id;
  ELSE
    RAISE NOTICE 'Perfil do sistema encontrado! UUID: %', system_user_id;
  END IF;

  -- Atualizar recursos oficiais
  UPDATE public.resources
  SET creator_id = system_user_id
  WHERE is_official = true
    AND creator_id != system_user_id;
END $$;

COMMENT ON COLUMN public.resources.creator_id IS 'ID do criador. Recursos oficiais usam o perfil do sistema (email: sistema@brasilpsd.com.br)';


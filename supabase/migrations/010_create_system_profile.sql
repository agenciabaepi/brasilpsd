-- Criar perfil oficial do sistema BrasilPSD
-- Este perfil será usado para recursos oficiais e pode ser gerenciado pelo admin

-- IMPORTANTE: Antes de executar esta migration, você precisa:
-- 1. Criar o usuário manualmente no Supabase Auth (Authentication > Users > Add User)
-- 2. Usar o email: sistema@brasilpsd.com.br
-- 3. Copiar o UUID gerado e substituir abaixo no lugar de 'SEU_UUID_AQUI'

-- Buscar o UUID do usuário pelo email (ou usar o UUID fixo se preferir)
DO $$
DECLARE
  system_user_id uuid;
  system_email TEXT := 'sistema@brasilpsd.com.br';
BEGIN
  -- Tentar buscar o UUID pelo email
  SELECT id INTO system_user_id
  FROM auth.users
  WHERE email = system_email
  LIMIT 1;

  -- Se não encontrou, usar UUID do sistema
  IF system_user_id IS NULL THEN
    system_user_id := '4fcdbfce-ea01-4a86-ad02-ec24dc6f3758'::uuid;
    RAISE NOTICE 'Usuário não encontrado pelo email. Usando UUID do sistema: %', system_user_id;
  ELSE
    RAISE NOTICE 'Usuário encontrado! UUID: %', system_user_id;
  END IF;

  -- Criar/atualizar o perfil do sistema
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    is_creator,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    system_user_id,
    system_email,
    'BrasilPSD',
    NULL,
    'admin',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_creator = EXCLUDED.is_creator,
    is_admin = EXCLUDED.is_admin,
    updated_at = NOW();
END $$;

-- Se as colunas opcionais existirem, atualizar também
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

  -- Se não encontrou, usar UUID do sistema
  IF system_user_id IS NULL THEN
    system_user_id := '4fcdbfce-ea01-4a86-ad02-ec24dc6f3758'::uuid;
  END IF;

  -- Atualizar is_premium se a coluna existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_premium'
  ) THEN
    UPDATE public.profiles
    SET is_premium = false
    WHERE id = system_user_id;
  END IF;

  -- Atualizar subscription_tier se a coluna existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'subscription_tier'
  ) THEN
    UPDATE public.profiles
    SET subscription_tier = 'free'
    WHERE id = system_user_id;
  END IF;

  -- Atualizar cover_image se a coluna existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'cover_image'
  ) THEN
    UPDATE public.profiles
    SET cover_image = NULL
    WHERE id = system_user_id;
  END IF;
END $$;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.id IS 'UUID do usuário. O perfil do sistema usa 00000000-0000-0000-0000-000000000001';


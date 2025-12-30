-- Adicionar constraint UNIQUE no CPF/CNPJ para prevenir duplicatas no banco
-- Primeiro, remover CPFs duplicados (manter apenas o primeiro registro de cada CPF)
-- Depois, adicionar índice UNIQUE

-- Passo 1: Identificar e remover CPFs duplicados (manter apenas o mais antigo)
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT cpf_cnpj, array_agg(id ORDER BY created_at) as ids
        FROM public.profiles
        WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != ''
        GROUP BY cpf_cnpj
        HAVING COUNT(*) > 1
    LOOP
        -- Manter o primeiro ID (mais antigo) e remover CPF dos demais
        UPDATE public.profiles
        SET cpf_cnpj = NULL
        WHERE id = ANY(rec.ids[2:array_length(rec.ids, 1)])
        AND cpf_cnpj = rec.cpf_cnpj;
        
        RAISE NOTICE 'Removido CPF duplicado: % (mantido no perfil mais antigo)', rec.cpf_cnpj;
    END LOOP;
END $$;

-- Passo 2: Adicionar índice UNIQUE (apenas em CPFs não nulos)
-- Nota: NULL não viola UNIQUE, então múltiplos NULLs são permitidos
-- Isso permite que usuários sem CPF possam existir, mas garante que cada CPF seja único
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj_unique 
ON public.profiles(cpf_cnpj) 
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';

-- Comentário explicativo
COMMENT ON INDEX idx_profiles_cpf_cnpj_unique IS 'Garante que cada CPF/CNPJ seja único na tabela profiles. Permite múltiplos registros com NULL.';





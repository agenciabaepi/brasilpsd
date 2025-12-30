-- ============================================
-- INSTRUÇÕES: Execute ESTE COMANDO SOZINHO
-- ============================================
-- 
-- 1. Copie APENAS a linha abaixo (sem comentários)
-- 2. Cole no SQL Editor do Supabase
-- 3. Execute
-- 4. Aguarde a confirmação de sucesso
-- 5. Feche e reabra o SQL Editor (ou aguarde 5 segundos)
-- 6. Depois execute a query de verificação (no final deste arquivo)
--
-- ============================================

ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'png';

-- ============================================
-- DEPOIS de executar o comando acima e aguardar,
-- execute esta query para verificar:
-- ============================================

-- SELECT 
--   CASE 
--     WHEN EXISTS (
--       SELECT 1 FROM pg_enum 
--       WHERE enumlabel = 'png' 
--       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resource_type')
--     ) THEN 'png está no enum ✅'
--     ELSE 'png NÃO está no enum ❌'
--   END AS status;




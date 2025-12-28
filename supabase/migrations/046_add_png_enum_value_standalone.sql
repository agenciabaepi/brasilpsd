-- IMPORTANTE: Execute este script PRIMEIRO e aguarde o commit
-- Antes de executar qualquer função que use 'png' como resource_type

-- Adicionar 'png' ao enum resource_type
-- Este comando deve ser executado sozinho e commitado antes de usar 'png'
-- NÃO execute outras queries junto com este comando!
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'png';

-- NOTA: Não execute queries de verificação na mesma transação!
-- Para verificar, execute separadamente:
-- SELECT unnest(enum_range(NULL::resource_type)) AS enum_value ORDER BY enum_value;


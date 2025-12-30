-- Adicionar 'motion' ao enum resource_type
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'motion';

-- Verificar se foi adicionado corretamente
-- SELECT unnest(enum_range(NULL::resource_type)) AS enum_value ORDER BY enum_value;


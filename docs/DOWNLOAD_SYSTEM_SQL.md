# 📚 Documentação SQL - Sistema de Downloads

## 📋 Visão Geral

Este documento descreve todas as funções SQL, triggers e índices criados para o sistema de controle de downloads.

---

## 🗄️ Estrutura da Tabela `downloads`

### Colunas Adicionadas

```sql
-- Colunas de auditoria
ip_address TEXT,
user_agent TEXT,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### Índices

```sql
-- Índice composto para contagem rápida de downloads por usuário e data
CREATE INDEX idx_downloads_user_created_at 
ON public.downloads(user_id, created_at DESC);

-- Índice em resource_id
CREATE INDEX idx_downloads_resource_id 
ON public.downloads(resource_id);
```

---

## 🔧 Funções SQL

### `get_download_limit(tier TEXT)`

**Descrição**: Retorna o limite de downloads diários baseado no tier do plano.

**Parâmetros**:
- `tier` (TEXT): Nome do tier ('free', 'lite', 'pro', 'ultra')

**Retorno**: `INTEGER` - Limite de downloads por dia

**Valores de Retorno**:
- `free`: 1
- `lite`: 3
- `pro`: 10
- `ultra`: 20
- `default`: 1 (caso tier inválido)

**Exemplo**:
```sql
SELECT public.get_download_limit('pro'); -- Retorna: 10
```

---

### `count_user_downloads_today(p_user_id UUID)`

**Descrição**: Conta quantos downloads o usuário fez hoje (baseado no timezone `America/Sao_Paulo`).

**Parâmetros**:
- `p_user_id` (UUID): ID do usuário

**Retorno**: `INTEGER` - Número de downloads feitos hoje

**Lógica**:
- Usa timezone `America/Sao_Paulo` para determinar "hoje"
- Considera downloads entre 00:00:00 e 23:59:59 (horário de Brasília)
- Usa `COALESCE(created_at, downloaded_at, NOW())` para garantir timestamp válido

**Exemplo**:
```sql
SELECT public.count_user_downloads_today('3f83bd21-d8ce-483a-a03b-bac87c26337c');
-- Retorna: 5 (se o usuário fez 5 downloads hoje)
```

---

### `get_user_download_status(p_user_id UUID)`

**Descrição**: Retorna status completo de downloads do usuário (contagem atual, limite, restantes, se pode fazer download, tier).

**Parâmetros**:
- `p_user_id` (UUID): ID do usuário

**Retorno**: `TABLE` com as seguintes colunas:
- `current_count` (INTEGER): Downloads feitos hoje
- `limit_count` (INTEGER): Limite do plano
- `remaining` (INTEGER): Downloads restantes
- `allowed` (BOOLEAN): Se pode fazer download
- `tier` (TEXT): Tier do plano atual

**Lógica**:
1. Busca assinatura ativa do usuário
2. Se não houver assinatura ativa, usa `subscription_tier` do profile ou 'free'
3. Calcula limite baseado no tier
4. Conta downloads de hoje
5. Calcula restantes e se pode fazer download

**Exemplo**:
```sql
SELECT * FROM public.get_user_download_status('3f83bd21-d8ce-483a-a03b-bac87c26337c');
-- Retorna:
-- current_count | limit_count | remaining | allowed | tier
-- 5             | 10          | 5        | true   | pro
```

---

### `check_download_limit(p_user_id UUID)`

**Descrição**: Verifica se o usuário pode fazer download (wrapper para `get_user_download_status`).

**Parâmetros**:
- `p_user_id` (UUID): ID do usuário

**Retorno**: `TABLE` com as seguintes colunas:
- `allowed` (BOOLEAN): Se pode fazer download
- `current_count` (INTEGER): Downloads feitos hoje
- `limit_count` (INTEGER): Limite do plano
- `remaining` (INTEGER): Downloads restantes

**Exemplo**:
```sql
SELECT * FROM public.check_download_limit('3f83bd21-d8ce-483a-a03b-bac87c26337c');
-- Retorna:
-- allowed | current_count | limit_count | remaining
-- true    | 5             | 10          | 5
```

---

### `register_download(p_user_id UUID, p_resource_id UUID, p_ip_address TEXT, p_user_agent TEXT)`

**Descrição**: Registra um download de forma atômica e segura, validando limites antes e depois da inserção.

**Parâmetros**:
- `p_user_id` (UUID): ID do usuário
- `p_resource_id` (UUID): ID do recurso
- `p_ip_address` (TEXT): IP do cliente (opcional)
- `p_user_agent` (TEXT): User Agent do navegador (opcional)

**Retorno**: `TABLE` com as seguintes colunas:
- `success` (BOOLEAN): Se o registro foi bem-sucedido
- `message` (TEXT): Mensagem de sucesso ou erro
- `download_id` (UUID): ID do download registrado (se sucesso)
- `current_count` (INTEGER): Downloads feitos hoje após registro
- `limit_count` (INTEGER): Limite do plano
- `remaining` (INTEGER): Downloads restantes após registro

**Lógica**:
1. Faz `FOR UPDATE` lock no profile do usuário (previne race conditions)
2. Verifica limite usando `get_user_download_status`
3. Se permitido, insere o registro de download
4. Verifica novamente após inserção (double-check)
5. Retorna resultado

**Exemplo**:
```sql
SELECT * FROM public.register_download(
  '3f83bd21-d8ce-483a-a03b-bac87c26337c'::UUID,
  '4fcdbfce-ea01-4a86-ad02-ec24dc6f3758'::UUID,
  '192.168.1.1',
  'Mozilla/5.0...'
);
-- Retorna:
-- success | message | download_id | current_count | limit_count | remaining
-- true    | ...     | uuid        | 6             | 10          | 4
```

**Erros Possíveis**:
- `Limite de downloads excedido`: Usuário já atingiu o limite diário
- `Recurso não encontrado`: Resource ID não existe
- `Limite excedido após validação`: Race condition detectada (muito raro)

---

### `can_user_download_resource(p_user_id UUID, p_resource_id UUID)`

**Descrição**: Verifica se um usuário pode baixar um recurso específico (recurso aprovado + limite não excedido).

**Parâmetros**:
- `p_user_id` (UUID): ID do usuário
- `p_resource_id` (UUID): ID do recurso

**Retorno**: `BOOLEAN` - `true` se pode fazer download, `false` caso contrário

**Lógica**:
1. Verifica se recurso existe e está aprovado
2. Verifica se limite de downloads não foi excedido

**Exemplo**:
```sql
SELECT public.can_user_download_resource(
  '3f83bd21-d8ce-483a-a03b-bac87c26337c'::UUID,
  '4fcdbfce-ea01-4a86-ad02-ec24dc6f3758'::UUID
);
-- Retorna: true ou false
```

---

## ⚡ Triggers

### `trigger_set_download_created_at`

**Descrição**: Garante que `created_at` e `downloaded_at` sejam sempre preenchidos.

**Tabela**: `public.downloads`

**Evento**: `BEFORE INSERT`

**Lógica**:
- Se `created_at` não for fornecido, usa `NOW()`
- Se `downloaded_at` não for fornecido, usa `NOW()`
- Garante consistência de timestamps

---

### `validate_download_before_insert`

**Descrição**: Validação adicional antes de inserir download (backup de segurança).

**Tabela**: `public.downloads`

**Evento**: `BEFORE INSERT`

**Lógica**:
- Verifica se recurso existe
- Não valida status do recurso (deixado para API)
- Não valida limite (deixado para `register_download`)

**Nota**: Este trigger é uma camada extra de segurança, mas a validação principal é feita pela função `register_download`.

---

## 🔐 Row Level Security (RLS)

### Políticas para `public.downloads`

```sql
-- Usuários autenticados podem ver seus próprios downloads
CREATE POLICY "Users can view own downloads"
  ON public.downloads FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários autenticados podem inserir seus próprios downloads
-- (mas a validação real é feita pela função register_download)
CREATE POLICY "Users can insert own downloads"
  ON public.downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins podem ver todos os downloads
CREATE POLICY "Admins can view all downloads"
  ON public.downloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

---

## 📊 Performance

### Índices Críticos

1. **`idx_downloads_user_created_at`**: Essencial para `count_user_downloads_today`
   - Permite busca rápida de downloads por usuário e data
   - Ordenação DESC otimizada

2. **`idx_downloads_resource_id`**: Para joins e validações de recurso

### Otimizações

- Uso de `FOR UPDATE` lock previne race conditions sem bloquear outras operações
- Timezone calculado uma vez por query
- `COALESCE` garante timestamp válido mesmo se `created_at` for NULL

---

## 🐛 Troubleshooting

### Função não encontrada

**Erro**: `function public.get_download_limit(text) does not exist`

**Solução**: Aplicar migration `033_create_download_security_system.sql`

### Ambiguidade de coluna

**Erro**: `column reference "tier" is ambiguous`

**Solução**: Aplicar migration `037_fix_tier_ambiguity.sql`

### Contagem incorreta

**Causa**: Problema com timezone ou `created_at` NULL

**Solução**: 
1. Verificar se `created_at` está sendo preenchido (trigger)
2. Verificar timezone do banco de dados
3. Aplicar migration `036_fix_count_downloads_fallback.sql`

---

## 📝 Notas de Implementação

### Timezone

- Todos os cálculos usam `America/Sao_Paulo`
- Reset do contador ocorre à meia-noite (horário de Brasília)

### Atomicidade

- `register_download` usa `FOR UPDATE` lock para garantir atomicidade
- Validação dupla (antes e depois) previne race conditions

### Segurança

- Validação em múltiplas camadas (API + Database)
- RLS policies garantem que usuários só vejam seus próprios downloads
- Triggers garantem integridade dos dados


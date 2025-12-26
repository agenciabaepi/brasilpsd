# Sistema de Verificação de Email e Validação de CPF

Este documento explica o sistema de verificação de email e validação de CPF implementado no BrasilPSD.

## Funcionalidades Implementadas

### 1. Validação de CPF/CNPJ Duplicado

- **API**: `/api/auth/check-cpf`
- **Método**: POST
- **Body**: `{ cpf_cnpj: string }`
- **Funcionalidade**: Verifica se um CPF/CNPJ já está cadastrado no sistema antes de permitir o cadastro
- **Validação**: O sistema não permite cadastrar dois usuários com o mesmo CPF/CNPJ

### 2. Sistema de Verificação de Email

#### Fluxo de Cadastro

1. **Usuário preenche formulário de cadastro** (`/signup`)
   - Validação de senhas
   - Validação de CPF/CNPJ (verifica se já existe)

2. **Sistema envia código de verificação**
   - API: `/api/auth/send-verification-code`
   - Gera código de 6 dígitos
   - Salva no banco de dados com validade de 15 minutos
   - **TODO**: Configurar envio de email (atualmente apenas loga no console)

3. **Usuário é redirecionado para página de verificação** (`/verify-email`)
   - Recebe email como parâmetro na URL
   - Insere código de 6 dígitos

4. **Após verificar código**
   - API: `/api/auth/verify-code`
   - Verifica se código é válido e não expirou
   - Se válido, marca como verificado e cria a conta no Supabase

#### APIs Criadas

1. **POST `/api/auth/send-verification-code`**
   - Verifica se email já está cadastrado
   - Gera código de 6 dígitos
   - Salva no banco (tabela `email_verification_codes`)
   - Expira em 15 minutos
   - **Em desenvolvimento**: Retorna código na resposta (para facilitar testes)

2. **POST `/api/auth/verify-code`**
   - Verifica se código é válido
   - Verifica se não expirou
   - Marca código como verificado
   - Retorna sucesso/erro

3. **POST `/api/auth/check-cpf`**
   - Verifica se CPF/CNPJ já está cadastrado
   - Retorna `{ exists: boolean }`

#### Banco de Dados

**Migration**: `031_create_email_verification_codes.sql`

Cria a tabela `email_verification_codes` com:
- `id`: UUID
- `email`: Email do usuário
- `code`: Código de 6 dígitos
- `expires_at`: Data de expiração (15 minutos)
- `verified`: Boolean (marca se foi verificado)
- `created_at`: Data de criação

**RLS Policies**:
- Permite inserção pública (controlado pela API)
- Permite leitura apenas de códigos não verificados e não expirados
- Permite atualização para marcar como verificado

## Configuração Necessária

### 1. Executar Migration

Execute a migration no Supabase SQL Editor:

```sql
-- Arquivo: supabase/migrations/031_create_email_verification_codes.sql
```

### 2. Configurar Envio de Email

Atualmente, o código de verificação apenas é logado no console. Para configurar o envio real de email:

1. **Configurar SMTP no Supabase** (recomendado) ou usar serviço externo (SendGrid, AWS SES, etc.)

2. **Atualizar `/api/auth/send-verification-code/route.ts`**:

```typescript
// Substituir esta parte:
console.log(`📧 Código de verificação para ${email}: ${code}`)

// Por:
await sendVerificationEmail(email, code)
```

3. **Criar função `sendVerificationEmail`**:
   - Usar Supabase Edge Function
   - Ou usar biblioteca como `nodemailer` com SMTP
   - Ou usar serviço de email como SendGrid, AWS SES, etc.

### 3. Em Produção

**IMPORTANTE**: Remover o código da resposta da API em produção:

```typescript
// Em /api/auth/send-verification-code/route.ts
// Remover esta parte em produção:
...(process.env.NODE_ENV === 'development' && { code })
```

## Testando o Sistema

### Em Desenvolvimento

1. Acesse `/signup`
2. Preencha o formulário
3. Clique em "Criar Conta"
4. O código será exibido no console do servidor
5. Acesse `/verify-email?email=seu@email.com`
6. Insira o código exibido no console
7. A conta será criada após verificação

### Validação de CPF

- Tente cadastrar com um CPF que já existe
- O sistema deve bloquear com mensagem: "Este CPF/CNPJ já está cadastrado"

## Próximos Passos

- [ ] Configurar envio de email real (SMTP ou serviço externo)
- [ ] Adicionar template de email HTML
- [ ] Adicionar rate limiting para evitar spam
- [ ] Adicionar opção de reenvio de código
- [ ] Adicionar contador de tentativas (limitar tentativas de verificação)
- [ ] Considerar usar serviços de email transacional (SendGrid, AWS SES, etc.)


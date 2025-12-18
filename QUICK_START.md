# 🚀 Guia Rápido de Configuração

## ⚠️ ERRO: Variáveis de Ambiente Não Configuradas

O erro que você está vendo é porque as variáveis de ambiente do Supabase não estão configuradas.

## 📝 Passo 1: Configurar Supabase

1. **Crie uma conta no Supabase** (se ainda não tiver):
   - Acesse: https://supabase.com
   - Crie um novo projeto

2. **Obtenha suas credenciais**:
   - Vá em: **Settings** > **API**
   - Copie os seguintes valores:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (mantenha em segredo!)

3. **Edite o arquivo `.env.local`**:
   ```bash
   # Abra o arquivo .env.local e substitua os valores:
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## 🗄️ Passo 2: Configurar Banco de Dados

1. **Execute as migrations**:
   - No Supabase, vá em **SQL Editor**
   - Execute o conteúdo de `supabase/migrations/001_initial_schema.sql`
   - Execute o conteúdo de `supabase/migrations/002_add_increment_function.sql`

## 🔄 Passo 3: Reiniciar o Servidor

Após configurar as variáveis de ambiente, **reinicie o servidor**:

```bash
# Pare o servidor atual (Ctrl+C) e rode novamente:
npm run dev
```

## ✅ Passo 4: Criar Primeiro Usuário Admin

1. **Crie uma conta** através da interface:
   - Acesse: http://localhost:3000/signup
   - Crie sua conta

2. **Torne-se admin** (no SQL Editor do Supabase):
   ```sql
   UPDATE public.profiles
   SET is_admin = true, is_creator = true, role = 'admin'
   WHERE email = 'seu-email@exemplo.com';
   ```

## 🎯 Próximos Passos (Opcional)

- Configure AWS S3 e CloudFront para upload de arquivos
- Adicione categorias iniciais
- Configure email templates

## ⚡ Modo de Desenvolvimento (Sem Supabase)

Se você quiser apenas testar a interface sem configurar o Supabase agora, você pode comentar temporariamente as chamadas do Supabase, mas isso limitará as funcionalidades.

---

**Dica**: Mantenha o arquivo `.env.local` seguro e nunca o commite no Git!


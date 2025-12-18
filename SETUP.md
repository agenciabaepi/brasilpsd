# Guia de Configuração - BrasilPSD

Este guia irá ajudá-lo a configurar o sistema BrasilPSD do zero.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase
- Conta na AWS com acesso ao S3 e CloudFront
- Git (opcional)

## 🚀 Passo a Passo

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Vá em Settings > API e copie:
   - Project URL
   - anon/public key
   - service_role key (mantenha em segredo!)

3. Execute as migrations:
   - Vá em SQL Editor no Supabase
   - Execute o conteúdo de `supabase/migrations/001_initial_schema.sql`
   - Execute o conteúdo de `supabase/migrations/002_add_increment_function.sql`

### 3. Configurar AWS S3 e CloudFront

1. **Criar bucket S3:**
   ```bash
   # Via AWS Console ou CLI
   aws s3 mb s3://brasilpsd-resources --region us-east-1
   ```

2. **Configurar CORS no bucket:**
   - Vá em Permissions > CORS
   - Adicione a configuração CORS apropriada

3. **Criar CloudFront Distribution:**
   - Crie uma distribuição apontando para o bucket S3
   - Configure o Origin Domain
   - Anote o CloudFront Domain Name

4. **Criar IAM User para acesso:**
   - Crie um usuário IAM com permissões S3
   - Gere Access Key ID e Secret Access Key

### 4. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# AWS S3
AWS_ACCESS_KEY_ID=sua_access_key
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=brasilpsd-resources
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=seu_jwt_secret_aleatorio
```

### 5. Criar Primeiro Usuário Admin

1. Execute no SQL Editor do Supabase:

```sql
-- Substitua 'seu-email@exemplo.com' pelo email que você usou para criar a conta
UPDATE public.profiles
SET is_admin = true, is_creator = true, role = 'admin'
WHERE email = 'seu-email@exemplo.com';
```

### 6. Executar o Projeto

```bash
npm run dev
```

O sistema estará disponível em `http://localhost:3000`

## 📁 Estrutura de Pastas

```
/app                 - Páginas e rotas
  /api               - API Routes
  /admin             - Painel administrativo
  /creator           - Dashboard de criadores
  /dashboard         - Dashboard de usuários
  /explore           - Página de exploração
  /resources         - Páginas de recursos
/components          - Componentes React
  /layout            - Header, Footer
  /resources         - Componentes de recursos
  /ui                - Componentes UI reutilizáveis
/lib                 - Utilitários e configurações
  /aws               - Integração AWS S3
  /supabase          - Clientes Supabase
  /utils             - Funções utilitárias
/types               - Tipos TypeScript
/supabase            - Migrations do banco
```

## 🔐 Segurança

- **NUNCA** commite o arquivo `.env.local`
- Mantenha a `SUPABASE_SERVICE_ROLE_KEY` em segredo
- Use variáveis de ambiente em produção
- Configure CORS adequadamente no S3
- Use HTTPS em produção

## 🎨 Personalização

### Cores

Edite `tailwind.config.ts` para personalizar as cores do tema.

### Logo

Substitua o componente de logo no `Header.tsx`.

## 📝 Próximos Passos

1. Configure categorias iniciais no banco de dados
2. Adicione tags populares
3. Configure email templates (opcional)
4. Configure analytics (opcional)
5. Deploy em produção (Vercel, AWS, etc.)

## 🐛 Troubleshooting

### Erro de conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas
- Verifique se o projeto Supabase está ativo

### Erro ao fazer upload
- Verifique as credenciais AWS
- Verifique as permissões do bucket S3
- Verifique se o CloudFront está configurado corretamente

### Erro de autenticação
- Limpe os cookies do navegador
- Verifique se as políticas RLS estão corretas

## 📚 Documentação Adicional

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)


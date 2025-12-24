# ⚡ Configuração Rápida do Asaas

## 🎯 Passo a Passo Rápido

### 1. Criar arquivo `.env.local`

Na raiz do projeto, crie um arquivo chamado `.env.local` (se ainda não existir).

### 2. Obter API Key do Asaas

1. Acesse: https://www.asaas.com/
2. Faça login na sua conta
3. Vá em **Integrações > API**
4. Clique em **Gerar Nova API Key**
5. **IMPORTANTE**: Copie a chave imediatamente (ela só aparece uma vez!)

### 3. Adicionar ao `.env.local`

Adicione estas linhas ao seu arquivo `.env.local`:

```env
# Asaas (Pagamentos)
ASAAS_API_KEY=cole_sua_api_key_aqui
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
```

**Para testes (Sandbox):**
```env
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
```

**Para produção:**
```env
ASAAS_API_URL=https://api.asaas.com/v3
```

### 4. Reiniciar o servidor

Após adicionar as variáveis, **reinicie o servidor**:

```bash
# Pare o servidor (Ctrl+C) e inicie novamente:
npm run dev
```

### 5. Testar

Tente criar uma assinatura novamente. O erro não deve mais aparecer!

---

## 📝 Exemplo completo do `.env.local`

Se você ainda não tem o arquivo, copie o conteúdo do `env.example` e preencha:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui

# AWS S3
AWS_ACCESS_KEY_ID=sua_aws_access_key
AWS_SECRET_ACCESS_KEY=sua_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=brasilpsd-resources
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=seu-cloudfront-domain.cloudfront.net

# Asaas (Pagamentos) ⬅️ ADICIONE ESTAS LINHAS
ASAAS_API_KEY=sua_asaas_api_key_aqui
ASAAS_API_URL=https://sandbox.asaas.com/api/v3

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=seu_jwt_secret_aleatorio_aqui_123456789
```

---

## ❓ Problemas Comuns

### Erro persiste após configurar?

1. ✅ Verifique se o arquivo está na **raiz do projeto** (mesmo nível do `package.json`)
2. ✅ Verifique se o nome do arquivo é exatamente `.env.local` (com o ponto no início)
3. ✅ **Reinicie o servidor** após adicionar as variáveis
4. ✅ Verifique se não há espaços antes ou depois do `=` na variável

### Não tenho conta no Asaas?

1. Acesse https://www.asaas.com/
2. Clique em "Criar Conta"
3. Complete o cadastro (pode usar dados de teste)
4. Após criar a conta, siga os passos acima para obter a API Key

### Quero testar sem pagar?

Use o **sandbox** do Asaas:
- URL: `https://sandbox.asaas.com/api/v3`
- Você pode criar contas de teste
- Não há cobranças reais

---

## 📚 Documentação Completa

Para mais detalhes, consulte: `ASAAS_SETUP.md`


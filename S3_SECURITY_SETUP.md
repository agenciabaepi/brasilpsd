# 🔒 Configuração de Segurança do S3

## ⚠️ IMPORTANTE: Configurar o Bucket S3 como PRIVADO

Para garantir que os vídeos não sejam acessíveis diretamente, o bucket S3 **DEVE** estar configurado como **PRIVADO**.

### Passos para Configurar:

1. **Acesse o AWS Console** → S3 → Seu Bucket

2. **Desabilitar Acesso Público:**
   - Vá em **Permissions** → **Block public access**
   - Marque **TODAS** as opções:
     - ✅ Block all public access
     - ✅ Block public access to buckets and objects granted through new access control lists (ACLs)
     - ✅ Block public access to buckets and objects granted through any access control lists (ACLs)
     - ✅ Block public access to buckets and objects granted through new public bucket or access point policies
     - ✅ Block public access to buckets and objects granted through any public bucket or access point policies
   - Clique em **Save changes**

3. **Remover Políticas Públicas (se existirem):**
   - Vá em **Permissions** → **Bucket Policy**
   - Remova qualquer política que permita acesso público (ex: `"Effect": "Allow"` com `"Principal": "*"`)
   - O bucket deve estar completamente privado

4. **Verificar CORS (mantenha apenas para uploads):**
   - Vá em **Permissions** → **CORS**
   - Mantenha apenas as regras necessárias para uploads do seu domínio
   - NÃO permita acesso público via CORS

### Como Funciona Agora:

- ✅ **Arquivos originais** (`file_url`): Privados, apenas acessíveis via signed URL após autenticação
- ✅ **Previews com marca d'água** (`preview_url`): Privados, apenas acessíveis via signed URL após autenticação
- ✅ **Thumbnails**: Podem ser públicos (são apenas imagens de preview)

### Validação:

Após configurar, teste:
1. Tente acessar diretamente uma URL do S3: `https://seu-bucket.s3.region.amazonaws.com/path/to/file.mp4`
2. Deve retornar **403 Forbidden** ou **Access Denied**
3. Apenas signed URLs devem funcionar

### Nota:

Se você já tem arquivos públicos no bucket, eles continuarão acessíveis até que você:
1. Remova as políticas públicas
2. Ou mova os arquivos para um novo bucket privado






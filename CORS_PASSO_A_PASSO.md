# 🚨 CONFIGURAÇÃO CORS - PASSO A PASSO VISUAL

## ⚠️ PROBLEMA ATUAL
O erro `status: 0` e `responseText: ''` confirma que o navegador está bloqueando a requisição por falta de CORS.

## 📋 PASSO A PASSO DETALHADO

### 1️⃣ Acesse o AWS Console
- Vá para: https://console.aws.amazon.com/s3/
- Faça login na sua conta AWS

### 2️⃣ Encontre o Bucket
- Na lista de buckets, procure por: **brasilpsd-arquivos**
- (Ou o nome do bucket configurado na variável `AWS_S3_BUCKET_NAME`)

### 3️⃣ Abra as Configurações do Bucket
- Clique no nome do bucket para abrir
- No menu superior, clique em **Permissions** (Permissões)

### 4️⃣ Configure CORS
- Role a página até encontrar **Cross-origin resource sharing (CORS)**
- Clique em **Edit** (Editar)

### 5️⃣ Cole a Configuração
**APAGUE** qualquer configuração existente e cole exatamente isto:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "HEAD",
            "DELETE"
        ],
        "AllowedOrigins": [
            "https://www.brasilpsd.com.br",
            "https://brasilpsd.com.br",
            "http://localhost:3000",
            "http://localhost:3001"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

### 6️⃣ Salve
- Clique em **Save changes** (Salvar alterações)
- Aguarde a mensagem de confirmação

### 7️⃣ Aguarde Propagação
- CORS geralmente propaga em 1-2 minutos
- Em casos raros, pode levar até 5 minutos

### 8️⃣ Teste Novamente
- Volte para a página de upload
- Tente fazer upload novamente
- O erro deve desaparecer

## ✅ VERIFICAÇÃO

Após configurar, você pode verificar se está correto:

1. **No AWS Console:**
   - Vá em Permissions > CORS
   - Você deve ver a configuração que acabou de salvar

2. **No Console do Navegador:**
   - Abra DevTools (F12) > Network
   - Tente fazer upload
   - A requisição PUT para o S3 deve ter status **200** ou **204**
   - Não deve aparecer erro CORS

## 🔍 TROUBLESHOOTING

### Se ainda não funcionar:

1. **Verifique o nome do bucket:**
   ```bash
   # Verifique qual bucket está configurado
   echo $AWS_S3_BUCKET_NAME
   # Ou verifique no arquivo .env.local
   ```

2. **Verifique o domínio:**
   - Certifique-se de que o domínio da Vercel está na lista de `AllowedOrigins`
   - Se seu site é `https://brasilpsd.vercel.app`, adicione também:
     ```json
     "https://brasilpsd.vercel.app"
     ```

3. **Teste com curl:**
   ```bash
   # Obtenha uma presigned URL do sistema
   # Depois teste:
   curl -X PUT "PRESIGNED_URL_AQUI" \
     -H "Content-Type: video/quicktime" \
     --upload-file teste.mov \
     -v
   ```
   - Se funcionar com curl mas não no navegador = problema CORS
   - Se não funcionar com curl = problema de permissões ou URL

4. **Verifique permissões do bucket:**
   - Vá em Permissions > Bucket Policy
   - O bucket pode estar bloqueado para PUT requests
   - Se necessário, adicione uma política que permita PUT (mas mantenha privado)

## 📝 NOTAS IMPORTANTES

- **CORS não torna o bucket público** - apenas permite requisições cross-origin de domínios específicos
- **AllowedOrigins** - Adicione TODOS os domínios onde você fará upload
- **PUT é essencial** - Sem `PUT` na lista de métodos, upload direto não funciona
- **Headers** - `*` permite todos os headers (mais permissivo, mas necessário para uploads)

## 🆘 SE NADA FUNCIONAR

Se após seguir todos os passos ainda não funcionar:

1. Verifique se você tem permissões para editar CORS no bucket
2. Verifique se o bucket está na região correta (`us-east-2`)
3. Tente criar um novo bucket com CORS configurado desde o início
4. Entre em contato com o administrador AWS se não tiver permissões


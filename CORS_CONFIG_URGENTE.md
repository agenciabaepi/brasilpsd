# ⚠️ CONFIGURAÇÃO CORS URGENTE - Bucket S3

O erro "Possível problema de CORS no bucket S3" indica que o bucket não está configurado para aceitar uploads diretos do navegador.

## 🚀 Configuração Rápida (AWS Console)

### Passo 1: Acesse o AWS Console
1. Vá para https://console.aws.amazon.com/s3/
2. Selecione o bucket: **brasilpsd-arquivos** (ou o nome do seu bucket)

### Passo 2: Configurar CORS
1. Clique no bucket
2. Vá na aba **Permissions** (Permissões)
3. Role até **Cross-origin resource sharing (CORS)**
4. Clique em **Edit** (Editar)
5. Cole o seguinte JSON:

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

6. Clique em **Save changes** (Salvar alterações)

### Passo 3: Verificar
- Aguarde 1-2 minutos para a configuração propagar
- Tente fazer upload novamente

## 🔧 Configuração via AWS CLI (Alternativa)

Se você tem AWS CLI configurado:

```bash
# Criar arquivo cors-config.json
cat > cors-config.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "DELETE"],
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
}
EOF

# Aplicar configuração
aws s3api put-bucket-cors \
  --bucket brasilpsd-arquivos \
  --cors-configuration file://cors-config.json

# Verificar
aws s3api get-bucket-cors --bucket brasilpsd-arquivos
```

## ✅ Verificação

Após configurar, você pode verificar se está funcionando:

1. **No console do navegador**, ao tentar upload, você deve ver:
   - Status 200 ou 204 (sucesso)
   - Sem erros de CORS

2. **Teste rápido com curl** (opcional):
   ```bash
   # Primeiro, obtenha uma presigned URL do seu sistema
   # Depois teste:
   curl -X PUT "PRESIGNED_URL_AQUI" \
     -H "Content-Type: video/mp4" \
     --upload-file teste.mp4
   ```

## 🐛 Se ainda não funcionar

1. **Verifique o nome do bucket**: Confirme que está usando o bucket correto
2. **Verifique as origens**: Certifique-se de que o domínio da Vercel está na lista de `AllowedOrigins`
3. **Aguarde propagação**: CORS pode levar até 5 minutos para propagar
4. **Verifique permissões do bucket**: O bucket precisa permitir PUT requests

## 📝 Notas Importantes

- **AllowedOrigins**: Adicione TODOS os domínios onde você fará upload
  - Produção: `https://www.brasilpsd.com.br`
  - Produção alternativo: `https://brasilpsd.com.br`
  - Desenvolvimento: `http://localhost:3000`
  
- **AllowedMethods**: `PUT` é essencial para upload direto

- **AllowedHeaders**: `*` permite todos os headers (mais permissivo, mas funciona)

## 🔒 Segurança

Após configurar CORS, o bucket ainda pode estar privado. CORS não torna o bucket público, apenas permite requisições cross-origin de domínios específicos.


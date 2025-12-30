# Configuração CORS para Upload Direto ao S3

Para que o upload direto ao S3 funcione corretamente, é necessário configurar CORS no bucket S3.

## Configuração CORS no AWS Console

1. Acesse o AWS Console e vá para o bucket S3
2. Vá em **Permissions** > **Cross-origin resource sharing (CORS)**
3. Clique em **Edit** (Editar)
4. **IMPORTANTE:** O console do AWS espera APENAS o array, não um objeto com `CORSRules`
5. Cole a seguinte configuração (sem o objeto externo):

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

**⚠️ ATENÇÃO:** 
- NÃO inclua `{ "CORSRules": [...] }`
- NÃO inclua a palavra "json" no início
- Cole APENAS o array `[...]` mostrado acima

## Configuração via AWS CLI

```bash
aws s3api put-bucket-cors \
  --bucket brasilpsd-arquivos \
  --cors-configuration file://cors-config.json
```

Onde `cors-config.json` contém:

```json
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
```

## Verificar Configuração

```bash
aws s3api get-bucket-cors --bucket brasilpsd-arquivos
```

## Troubleshooting

Se ainda houver erro de conexão após configurar CORS:

1. **Verifique se o bucket permite PUT requests**: Vá em Permissions > Bucket Policy
2. **Verifique se a presigned URL está válida**: Ela expira em 1 hora
3. **Verifique os logs do navegador**: Abra o DevTools > Network e veja a resposta do erro
4. **Teste com curl**:
   ```bash
   curl -X PUT "PRESIGNED_URL_AQUI" \
     -H "Content-Type: video/mp4" \
     --upload-file arquivo.mp4
   ```

## Notas Importantes

- CORS leva alguns minutos para propagar (geralmente imediato, mas pode levar até 5 minutos)
- Certifique-se de incluir todos os domínios onde o upload será feito
- Para desenvolvimento local, inclua `http://localhost:3000` e outras portas que você usa
- O `MaxAgeSeconds` define por quanto tempo o navegador cacheia a resposta CORS (3000 segundos = ~50 minutos)


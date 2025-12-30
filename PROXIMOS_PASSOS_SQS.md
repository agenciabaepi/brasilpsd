# 🎯 Próximos Passos Após Criar Fila SQS

## ✅ Passo 1: Copiar URL da Fila

Na página da fila que você acabou de criar no AWS Console:
1. **Copie a URL** que aparece no topo da página
   - Formato: `https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue`
   - Exemplo de onde encontrar: no topo da página da fila, logo abaixo do nome

## ✅ Passo 2: Configurar no Projeto Next.js

Adicione a URL da fila no arquivo `.env.local` (na raiz do projeto):

```bash
# Abra ou crie o arquivo .env.local
```

Adicione esta linha (se ainda não existir):

```env
# AWS SQS (para processamento assíncrono de vídeos)
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue
```

**⚠️ IMPORTANTE:** Substitua pela URL que você copiou!

## ✅ Passo 3: Configurar Worker Docker

### 3.1. Criar arquivo `.env` do worker:

```bash
cd worker
cp .env.example .env
```

### 3.2. Editar `worker/.env` com suas credenciais:

```env
# AWS Configuration
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=sua_access_key_aqui
AWS_SECRET_ACCESS_KEY=sua_secret_key_aqui
AWS_S3_BUCKET_NAME=brasilpsd-arquivos

# SQS Queue (cole a URL que você copiou)
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue

# Supabase (para atualizar banco após processamento)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

**⚠️ IMPORTANTE:** Preencha todos os valores com suas credenciais reais!

## ✅ Passo 4: Build e Executar Worker

### Opção A: Docker Compose (Recomendado)

```bash
cd worker
docker-compose up -d
```

### Opção B: Docker direto

```bash
cd worker
docker build -t brasilpsd-video-worker .
docker run -d \
  --name video-worker \
  --env-file .env \
  brasilpsd-video-worker
```

## ✅ Passo 5: Verificar se Está Funcionando

### 5.1. Ver logs do worker:

```bash
docker logs -f brasilpsd-video-worker
```

Você deve ver:
```
🚀 Worker iniciado
📋 Configuração: { region: 'us-east-2', bucket: '...', queue: '...' }
🔄 Polling SQS queue...
```

### 5.2. Fazer upload de um vídeo no sistema

1. Acesse a página de upload
2. Faça upload de um vídeo
3. O upload deve ser mais rápido (não espera processamento)
4. Verifique os logs do worker - deve mostrar processamento

### 5.3. Verificar banco de dados

Após alguns minutos, verifique se o vídeo foi processado:
- `file_url` deve apontar para MP4 convertido
- `preview_url` deve estar preenchido
- `thumbnail_url` deve estar preenchido
- `file_format` deve ser 'mp4'

## 🐛 Problemas Comuns

### Worker não inicia:
- Verifique se todas as variáveis em `worker/.env` estão corretas
- Verifique se Docker está rodando: `docker ps`

### Worker não processa mensagens:
- Verifique se `SQS_QUEUE_URL` está correto no `.env.local` e `worker/.env`
- Verifique permissões IAM (precisa de `sqs:ReceiveMessage`, `sqs:DeleteMessage`)
- Veja logs: `docker logs video-worker`

### Erro FFmpeg:
- Verifique se FFmpeg está instalado: `docker exec video-worker ffmpeg -version`
- Se não estiver, o build do Docker pode ter falhado

## ✅ Pronto!

Após configurar tudo, o fluxo funcionará assim:

1. **Upload de vídeo** → Vai direto para S3
2. **API enfileira** → Envia mensagem para SQS
3. **Worker processa** → Converte para MP4, gera preview e thumbnail
4. **Banco atualizado** → Automaticamente após processamento

O upload será **instantâneo** (não espera processamento) e o vídeo será processado em background! 🎉


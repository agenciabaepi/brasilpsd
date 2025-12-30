# 🚀 Instruções para Iniciar o Worker

## ✅ Passo 3: Configurar .env

O arquivo `.env` já foi criado automaticamente com suas credenciais do `.env.local`.

Se precisar recriar manualmente, copie o conteúdo abaixo:

```env
# AWS Configuration
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=SEU_ACCESS_KEY_ID_AQUI
AWS_SECRET_ACCESS_KEY=SEU_SECRET_ACCESS_KEY_AQUI
AWS_S3_BUCKET_NAME=brasilpsd-arquivos

# SQS Queue
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue

# Supabase (para atualizar banco após processamento)
SUPABASE_URL=SUA_SUPABASE_URL_AQUI
SUPABASE_SERVICE_ROLE_KEY=SUA_SUPABASE_SERVICE_ROLE_KEY_AQUI
```

## ✅ Passo 4: Iniciar Worker

### Opção 1: Usar Script (Mais Fácil)

```bash
cd worker
./start.sh
```

### Opção 2: Docker Compose

```bash
cd worker
docker compose up -d
```

ou

```bash
docker-compose up -d
```

### Opção 3: Docker Direto

```bash
cd worker

# Build da imagem
docker build -t brasilpsd-video-worker .

# Executar container
docker run -d \
  --name brasilpsd-video-worker \
  --env-file .env \
  --restart unless-stopped \
  brasilpsd-video-worker
```

## ✅ Verificar se Está Funcionando

### Ver logs:

```bash
docker logs -f brasilpsd-video-worker
```

Você deve ver:
```
🚀 Worker iniciado
📋 Configuração: { region: 'us-east-2', bucket: 'brasilpsd-arquivos', queue: '...' }
🔄 Polling SQS queue...
```

### Comandos Úteis:

```bash
# Ver logs em tempo real
docker logs -f brasilpsd-video-worker

# Ver status
docker ps | grep video-worker

# Parar worker
docker stop brasilpsd-video-worker

# Reiniciar worker
docker restart brasilpsd-video-worker

# Remover worker (se precisar recriar)
docker stop brasilpsd-video-worker
docker rm brasilpsd-video-worker
```

## ✅ Próximo Passo

Após iniciar o worker, faça upload de um vídeo no sistema para testar! 🎬


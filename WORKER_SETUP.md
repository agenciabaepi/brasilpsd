# 🚀 Setup do Worker de Processamento de Vídeo

Este guia explica como configurar o worker Docker para processamento assíncrono de vídeos usando SQS.

## 📋 Arquitetura

```
Upload → S3 (original) → SQS Queue → Worker Docker → Processa → Atualiza Banco
```

## 🔧 Pré-requisitos

1. **AWS SQS Queue criada**
2. **Docker instalado**
3. **Credenciais AWS configuradas**

## 📝 Passo 1: Criar Fila SQS

### Via AWS Console:
1. Acesse: https://console.aws.amazon.com/sqs/
2. Clique em "Create queue"
3. Escolha "Standard queue"
4. Nome: `video-processing-queue`
5. Configure:
   - **Visibility timeout**: 300 segundos (5 minutos)
   - **Message retention period**: 14 dias
   - **Receive message wait time**: 20 segundos (long polling)
6. Clique em "Create queue"
7. Copie a **Queue URL**

### Via AWS CLI:
```bash
aws sqs create-queue \
  --queue-name video-processing-queue \
  --attributes \
    VisibilityTimeout=300,\
    MessageRetentionPeriod=1209600,\
    ReceiveMessageWaitTimeSeconds=20
```

## 📝 Passo 2: Configurar Variáveis de Ambiente

### No projeto Next.js (`.env.local`):
```env
# SQS Queue
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/123456789012/video-processing-queue
```

### No worker (`worker/.env`):
```env
# AWS Configuration
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=brasilpsd-arquivos

# SQS Queue
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/123456789012/video-processing-queue

# Supabase (para atualizar banco após processamento)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📝 Passo 3: Build e Executar Worker

### Opção 1: Docker Compose (Recomendado)
```bash
cd worker
cp .env.example .env
# Edite .env com suas credenciais
docker-compose up -d
```

### Opção 2: Docker direto
```bash
cd worker
docker build -t brasilpsd-video-worker .
docker run -d \
  --name video-worker \
  --env-file .env \
  brasilpsd-video-worker
```

### Opção 3: Local (desenvolvimento)
```bash
cd worker
npm install
cp .env.example .env
# Edite .env
node index.js
```

## ✅ Verificar se está funcionando

1. **Ver logs do worker:**
   ```bash
   docker logs -f video-worker
   ```

2. **Fazer upload de um vídeo** no sistema

3. **Verificar fila SQS:**
   - AWS Console → SQS → video-processing-queue
   - Deve mostrar mensagens sendo processadas

4. **Verificar processamento:**
   - Logs do worker devem mostrar processamento
   - Banco de dados deve ser atualizado com MP4 convertido

## 🔍 Troubleshooting

### Worker não processa mensagens:
- Verifique se `SQS_QUEUE_URL` está correto
- Verifique permissões IAM (precisa de `sqs:ReceiveMessage`, `sqs:DeleteMessage`)
- Verifique logs: `docker logs video-worker`

### Erro de FFmpeg:
- Verifique se FFmpeg está instalado no container: `docker exec video-worker ffmpeg -version`
- Verifique se há espaço em disco: `docker exec video-worker df -h`

### Erro ao atualizar banco:
- Verifique `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- Verifique se a chave tem permissão para atualizar `resources`

## 📊 Monitoramento

### Ver métricas da fila:
```bash
aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names All
```

### Ver mensagens na fila:
```bash
aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

## 🔄 Escalabilidade

Para processar mais vídeos simultaneamente:

1. **Aumentar workers:**
   ```bash
   docker-compose up -d --scale video-worker=3
   ```

2. **Ou criar múltiplas instâncias:**
   - Cada instância pode rodar múltiplos workers
   - SQS distribui mensagens automaticamente

## 🔒 Segurança

- **IAM Policy necessária para o worker:**
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        "Resource": "arn:aws:sqs:us-east-2:123456789012:video-processing-queue"
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject",
          "s3:PutObject"
        ],
        "Resource": "arn:aws:s3:::brasilpsd-arquivos/*"
      }
    ]
  }
  ```

## 📝 Notas

- O worker processa mensagens continuamente (polling)
- Mensagens são deletadas automaticamente após processamento bem-sucedido
- Se processamento falhar, mensagem fica visível novamente após `VisibilityTimeout`
- Worker pode ser reiniciado sem perder mensagens (elas ficam na fila)


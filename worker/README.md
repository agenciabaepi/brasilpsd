# 🎬 Worker de Processamento de Vídeo

Worker Docker para processamento assíncrono de vídeos usando SQS e FFmpeg.

## 🚀 Quick Start

```bash
# 1. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 2. Build e executar com Docker Compose
docker-compose up -d

# 3. Ver logs
docker logs -f brasilpsd-video-worker
```

## 📋 O que o worker faz?

1. **Recebe mensagens da fila SQS** com informações do vídeo
2. **Baixa o arquivo original** do S3
3. **Converte para MP4** (H.264, otimizado para web)
4. **Gera preview leve** (metade do vídeo, 1280px max)
5. **Extrai thumbnail** (imagem JPG)
6. **Upload para S3**:
   - MP4 convertido → `resources/{userId}/`
   - Preview → `video-previews/{userId}/`
   - Thumbnail → `thumbnails/{userId}/`
7. **Atualiza banco de dados** via Supabase

## ⚙️ Configuração

Veja `WORKER_SETUP.md` para instruções completas de setup.

## 🔧 Preset FFmpeg

### Conversão para MP4:
```bash
ffmpeg -i input.mov \
  -c:v libx264 \
  -preset fast \
  -profile:v main \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -crf 23 \
  -an \
  output.mp4
```

### Preview (leve):
```bash
ffmpeg -i input.mp4 \
  -t 30 \
  -c:v libx264 \
  -preset fast \
  -profile:v main \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -crf 28 \
  -vf scale=1280:-2 \
  -an \
  preview.mp4
```

## 📊 Monitoramento

```bash
# Ver logs em tempo real
docker logs -f brasilpsd-video-worker

# Ver métricas da fila SQS
aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

## 🔄 Escalabilidade

Para processar mais vídeos simultaneamente:

```bash
# Múltiplos workers
docker-compose up -d --scale video-worker=3
```

## 🐛 Troubleshooting

- **Worker não processa**: Verifique `SQS_QUEUE_URL` e permissões IAM
- **Erro FFmpeg**: Verifique se FFmpeg está instalado: `docker exec brasilpsd-video-worker ffmpeg -version`
- **Erro Supabase**: Verifique `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`


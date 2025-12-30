# ✅ Tudo Configurado! Como Iniciar o Worker

## 🎉 Status

- ✅ Node.js instalado (v20.19.5)
- ✅ FFmpeg instalado (v7.1.1)
- ✅ Dependências instaladas
- ✅ Arquivo `.env` configurado
- ✅ SQS Queue criada

## 🚀 Iniciar Worker (Escolha uma opção)

### Opção 1: Terminal Normal (Recomendado para testes)

Abra um novo terminal e execute:

```bash
cd /Users/lucasoliveira/BrasilPsd/worker
npm start
```

O worker ficará rodando e você verá os logs em tempo real.

**Para parar:** Pressione `Ctrl+C`

### Opção 2: Em Background (Para uso contínuo)

```bash
cd /Users/lucasoliveira/BrasilPsd/worker

# Com nohup (continua mesmo se fechar o terminal)
nohup npm start > worker.log 2>&1 &

# Ver logs
tail -f worker.log

# Parar (encontrar o processo e matar)
ps aux | grep "node.*index.js"
kill <PID>
```

### Opção 3: Com PM2 (Gerenciador de Processos)

```bash
# Instalar PM2 globalmente (se ainda não tiver)
npm install -g pm2

cd /Users/lucasoliveira/BrasilPsd/worker

# Iniciar worker
pm2 start index.js --name video-worker

# Ver logs
pm2 logs video-worker

# Ver status
pm2 status

# Parar
pm2 stop video-worker

# Reiniciar
pm2 restart video-worker
```

## ✅ O que você deve ver:

Quando iniciar, você deve ver:

```
🚀 Worker iniciado
📋 Configuração: { 
  region: 'us-east-2', 
  bucket: 'brasilpsd-arquivos', 
  queue: 'https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue' 
}
🔄 Polling SQS queue...
```

## 🧪 Testar

1. Inicie o worker (usando uma das opções acima)
2. Faça upload de um vídeo no sistema (página de upload)
3. Veja os logs do worker processando o vídeo
4. Verifique no banco de dados se o vídeo foi convertido

## 📝 Nota sobre Docker

Se preferir usar Docker no futuro (mais isolado e fácil de gerenciar):

1. Instale Docker Desktop: https://www.docker.com/products/docker-desktop
2. Execute: `cd worker && ./start.sh`

Mas para desenvolvimento/teste, rodar com Node.js diretamente está perfeito! ✅


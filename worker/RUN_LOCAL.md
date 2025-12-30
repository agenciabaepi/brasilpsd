# 🖥️ Executar Worker Localmente (Sem Docker)

Se você não tem Docker instalado, pode executar o worker diretamente com Node.js.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- FFmpeg instalado no sistema

### Instalar FFmpeg:

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Baixe de: https://ffmpeg.org/download.html

## 🚀 Passos

### 1. Instalar dependências:

```bash
cd worker
npm install
```

### 2. Verificar se .env existe:

```bash
# O arquivo .env já deve existir (foi criado automaticamente)
ls -la .env
```

### 3. Executar worker:

```bash
npm start
```

Ou em modo desenvolvimento (com auto-reload):

```bash
npm run dev
```

## ✅ Verificar

Você deve ver no terminal:

```
🚀 Worker iniciado
📋 Configuração: { region: 'us-east-2', bucket: 'brasilpsd-arquivos', queue: '...' }
🔄 Polling SQS queue...
```

## ⚠️ Nota

- O worker ficará rodando no terminal enquanto estiver ativo
- Para parar, pressione `Ctrl+C`
- Para rodar em background, use `nohup` ou um gerenciador de processos como `pm2`

## 🔄 Rodar em Background

```bash
# Com nohup
nohup npm start > worker.log 2>&1 &

# Ou com pm2 (se tiver instalado)
npm install -g pm2
pm2 start index.js --name video-worker
pm2 logs video-worker
```


FROM node:18-alpine

# Instalar FFmpeg e dependências
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código do worker
COPY worker/ ./

# Expor porta (se necessário para health check)
EXPOSE 3001

# Comando para rodar o worker
CMD ["node", "index.js"]


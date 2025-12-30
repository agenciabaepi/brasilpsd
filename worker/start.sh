#!/bin/bash

# Script para iniciar o worker Docker

echo "🚀 Iniciando worker de processamento de vídeo..."

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "Por favor, crie o arquivo .env baseado no .env.example"
    exit 1
fi

# Tentar docker compose primeiro (versão nova)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    echo "📦 Usando docker compose..."
    docker compose up -d
elif command -v docker-compose &> /dev/null; then
    echo "📦 Usando docker-compose..."
    docker-compose up -d
elif command -v docker &> /dev/null; then
    echo "📦 Construindo imagem Docker..."
    docker build -t brasilpsd-video-worker .
    
    echo "🚀 Iniciando container..."
    docker run -d \
        --name brasilpsd-video-worker \
        --env-file .env \
        --restart unless-stopped \
        brasilpsd-video-worker
else
    echo "❌ Docker não encontrado!"
    echo "Por favor, instale Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "✅ Worker iniciado!"
echo ""
echo "Para ver os logs:"
echo "  docker logs -f brasilpsd-video-worker"
echo ""
echo "Para parar o worker:"
echo "  docker stop brasilpsd-video-worker"
echo "  docker rm brasilpsd-video-worker"


# ⚙️ Configuração da Fila SQS - Passo a Passo

## 📋 Configurações Recomendadas

### 1. Tipo de Fila
✅ **Escolha: Padrão (Standard)**
- Entrega pelo menos uma vez
- Ordem não preservada (não importa para vídeos)
- Maior throughput e mais barato

### 2. Nome da Fila
```
video-processing-queue
```

### 3. Configurações Importantes

#### ⏱️ Tempo limite de visibilidade
**300 segundos (5 minutos)**
- Tempo que o worker tem para processar antes da mensagem ficar visível novamente
- Deve ser maior que o tempo médio de processamento

#### 📦 Período de retenção da mensagem
**14 dias**
- Tempo que mensagens não processadas ficam na fila
- Máximo recomendado para não perder mensagens

#### ⏳ Atraso de entrega
**0 segundos**
- Não precisa de delay

#### 📏 Tamanho máximo da mensagem
**1024 KB**
- Nossas mensagens são pequenas (só JSON), então 1024 KB está mais que suficiente

#### 🔄 Tempo de espera do recebimento da mensagem
**20 segundos**
- Long polling - reduz custos e latência
- Worker está configurado para isso

### 4. Criptografia
**Desabilitada** (ou habilitada se precisar de segurança extra)
- Para desenvolvimento/teste: desabilitada está OK
- Para produção: considere habilitar

### 5. Política de Acesso
**Básico** → **Somente o proprietário da fila**
- Para começar, isso está OK
- Depois pode configurar IAM roles específicas

### 6. Fila de Mensagens Mortas
**Habilitada** (recomendado)
- Cria uma fila separada para mensagens que falharam múltiplas vezes
- Útil para debug e monitoramento

## ✅ Resumo das Configurações

```
Tipo: Padrão (Standard)
Nome: video-processing-queue
Tempo limite de visibilidade: 300 segundos
Período de retenção: 14 dias
Atraso de entrega: 0 segundos
Tamanho máximo: 1024 KB
Tempo de espera: 20 segundos
Criptografia: Desabilitada (ou habilitada)
Política: Somente proprietário
Fila de mensagens mortas: Habilitada (opcional)
```

## 📝 Após Criar

1. **Copie a URL da fila** (aparece após criar)
   - Formato: `https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue`

2. **Adicione no `.env.local`:**
   ```env
   SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue
   ```

3. **Configure permissões IAM** (se necessário):
   - O usuário/role precisa de:
     - `sqs:SendMessage`
     - `sqs:ReceiveMessage`
     - `sqs:DeleteMessage`
     - `sqs:GetQueueAttributes`

## 🎯 Próximo Passo

Após criar a fila, configure o worker seguindo `WORKER_SETUP.md`


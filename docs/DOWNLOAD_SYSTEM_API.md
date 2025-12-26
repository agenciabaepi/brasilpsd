# 📚 Documentação da API - Sistema de Downloads

## 📋 Visão Geral

O sistema de downloads implementa controle de limites diários baseado no plano de assinatura do usuário, com validações de segurança em múltiplas camadas.

---

## 🔌 Endpoints da API

### POST `/api/download`

**Descrição**: Endpoint principal para realizar downloads de recursos.

**Autenticação**: Requerida (JWT via cookies)

**Rate Limiting**: 
- 20 requisições por minuto por IP
- 100 requisições por hora por IP

**Request Body**:
```json
{
  "resourceId": "uuid-do-recurso",
  "key": "chave-s3-do-arquivo"
}
```

**Response Success (200)**:
```json
{
  "url": "https://s3-signed-url...",
  "download_id": "uuid-do-download",
  "current_count": 5,
  "limit_count": 10,
  "remaining": 5,
  "message": "Atenção: Você tem apenas 5 downloads restantes hoje."
}
```

**Response Errors**:

- **401 Unauthorized**: Usuário não autenticado
  ```json
  {
    "error": "Não autorizado",
    "message": "Você precisa fazer login para baixar recursos."
  }
  ```

- **403 Forbidden**: Limite de downloads excedido
  ```json
  {
    "error": "Limite de downloads excedido",
    "message": "Você já fez 10 de 10 downloads hoje. Tente novamente amanhã.",
    "current_count": 10,
    "limit_count": 10,
    "remaining": 0,
    "suggestion": "Considere fazer upgrade do seu plano para baixar mais recursos!"
  }
  ```

- **404 Not Found**: Recurso não encontrado
  ```json
  {
    "error": "Recurso não encontrado",
    "message": "O recurso que você está tentando baixar não existe ou foi removido."
  }
  ```

- **429 Too Many Requests**: Rate limit excedido
  ```json
  {
    "error": "Muitas requisições",
    "message": "Você fez muitas requisições. Tente novamente em 45 segundos.",
    "retryAfter": 45
  }
  ```

- **500 Internal Server Error**: Erro interno
  ```json
  {
    "error": "Erro ao verificar limite de downloads",
    "message": "Não foi possível verificar seu limite de downloads. Por favor, tente novamente em alguns instantes."
  }
  ```

**Headers de Resposta**:
- `X-RateLimit-Limit`: Limite de requisições
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Timestamp de reset do rate limit

**Validações Realizadas**:
1. ✅ Autenticação do usuário
2. ✅ Rate limiting por IP
3. ✅ Verificação de plano ativo
4. ✅ Verificação de limite de downloads diário
5. ✅ Validação de existência do recurso
6. ✅ Validação de status do recurso (aprovado ou criador/admin)
7. ✅ Registro de download com auditoria (IP, User Agent)
8. ✅ Geração de URL assinada S3

**Cache**: 
- Status de downloads é cacheado por 30 segundos
- Cache é invalidado automaticamente após cada download

---

### GET `/api/downloads/status`

**Descrição**: Retorna o status atual de downloads do usuário autenticado.

**Autenticação**: Requerida (JWT via cookies)

**Response Success (200)**:
```json
{
  "current": 5,
  "limit": 10,
  "remaining": 5,
  "allowed": true,
  "plan": "pro"
}
```

**Response Errors**:

- **401 Unauthorized**: Usuário não autenticado
  ```json
  {
    "error": "Não autorizado",
    "message": "Você precisa estar autenticado para verificar seu status de downloads."
  }
  ```

- **500 Internal Server Error**: Erro ao obter status
  ```json
  {
    "error": "Erro ao obter status de downloads",
    "message": "Não foi possível obter seu status de downloads. Por favor, tente novamente."
  }
  ```

**Cache**: 
- Resposta é cacheada por 30 segundos
- Header `X-Cache-Status` indica se foi cache hit ou miss

---

## 🔒 Segurança

### Camadas de Validação

1. **Frontend**: Exibe status e desabilita botão quando necessário
2. **API Route**: Valida autenticação, rate limit, e parâmetros
3. **Database RPC**: Valida limites usando transações atômicas com `FOR UPDATE`
4. **Database Trigger**: Validação adicional antes de inserir download

### Prevenção de Bypass

- ✅ Validação no servidor (não confia no frontend)
- ✅ Transações atômicas com locks (`FOR UPDATE`)
- ✅ Rate limiting por IP
- ✅ Auditoria completa (IP, User Agent, timestamp)
- ✅ Validação dupla (antes e depois do registro)

### Timezone

- Todos os cálculos de "hoje" usam timezone `America/Sao_Paulo`
- Reset do contador ocorre à meia-noite (horário de Brasília)

---

## 📊 Limites por Plano

| Plano | Downloads/Dia |
|-------|---------------|
| Free  | 1             |
| Lite  | 3             |
| Pro   | 10            |
| Ultra | 20            |

---

## 🐛 Troubleshooting

### Erro: "Sistema de downloads não configurado"

**Causa**: Migrations não foram aplicadas no Supabase.

**Solução**: Aplicar migrations 033, 034, 035, 036, 037 no Supabase SQL Editor.

### Erro: "Limite de downloads excedido" mas usuário não fez downloads

**Causa**: Possível problema com timezone ou contagem incorreta.

**Solução**: 
1. Verificar timezone do banco de dados
2. Verificar função `count_user_downloads_today`
3. Verificar se `created_at` está sendo preenchido corretamente

### Rate Limit sendo acionado incorretamente

**Causa**: Múltiplos usuários atrás do mesmo proxy/load balancer.

**Solução**: Em produção, considerar usar identificação por usuário autenticado além do IP.

---

## 📝 Logs de Auditoria

Todos os downloads são registrados na tabela `public.downloads` com:
- `user_id`: ID do usuário
- `resource_id`: ID do recurso
- `ip_address`: IP do cliente
- `user_agent`: User Agent do navegador
- `created_at`: Timestamp do download

---

## 🔄 Cache e Performance

### Cache de Status de Downloads
- **TTL**: 30 segundos
- **Invalidação**: Automática após cada download
- **Localização**: Memória do servidor (em produção, considerar Redis)

### Rate Limiting
- **Armazenamento**: Memória do servidor (em produção, considerar Redis)
- **Limpeza**: Automática a cada minuto

---

## 📈 Monitoramento

### Métricas Importantes

1. **Taxa de downloads bloqueados**: Downloads que falharam por limite excedido
2. **Taxa de cache hit**: Percentual de requisições atendidas pelo cache
3. **Tempo médio de resposta**: Performance da API
4. **Rate limit hits**: Quantas vezes o rate limit foi acionado

### Logs para Monitorar

- `✅ Download authorized`: Download bem-sucedido
- `⚠️ Download blocked: Limit exceeded`: Limite excedido
- `⚠️ Download blocked: Rate limit exceeded`: Rate limit acionado
- `❌ Download failed`: Erros diversos


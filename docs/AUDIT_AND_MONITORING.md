# 📊 Auditoria e Monitoramento - Sistema de Downloads

## 🔍 Logs de Auditoria

### Tabela `public.downloads`

Todos os downloads são registrados na tabela `downloads` com as seguintes informações:

```sql
CREATE TABLE public.downloads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  resource_id UUID NOT NULL,
  ip_address TEXT,           -- IP do cliente
  user_agent TEXT,           -- User Agent do navegador
  created_at TIMESTAMP,      -- Timestamp do download
  downloaded_at TIMESTAMP       -- Timestamp alternativo
);
```

### Campos de Auditoria

- **`ip_address`**: IP do cliente (obtido de headers `x-forwarded-for` ou `x-real-ip`)
- **`user_agent`**: User Agent do navegador (para identificar dispositivo/navegador)
- **`created_at`**: Timestamp exato do download (timezone UTC)
- **`downloaded_at`**: Timestamp alternativo (fallback)

### Consultas Úteis

#### Downloads de um usuário hoje

```sql
SELECT 
  d.id,
  d.created_at,
  d.ip_address,
  d.user_agent,
  r.title as resource_title
FROM public.downloads d
JOIN public.resources r ON r.id = d.resource_id
WHERE d.user_id = 'user-id'::UUID
  AND DATE(d.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY d.created_at DESC;
```

#### Downloads por IP (detecção de abuso)

```sql
SELECT 
  ip_address,
  COUNT(*) as download_count,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_download,
  MAX(created_at) as last_download
FROM public.downloads
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 50  -- Mais de 50 downloads em 24h
ORDER BY download_count DESC;
```

#### Downloads por recurso

```sql
SELECT 
  r.title,
  r.id,
  COUNT(d.id) as download_count,
  COUNT(DISTINCT d.user_id) as unique_downloaders
FROM public.resources r
LEFT JOIN public.downloads d ON d.resource_id = r.id
WHERE d.created_at >= NOW() - INTERVAL '7 days'
GROUP BY r.id, r.title
ORDER BY download_count DESC
LIMIT 20;
```

#### Usuários com mais downloads

```sql
SELECT 
  p.email,
  p.full_name,
  COUNT(d.id) as total_downloads,
  COUNT(CASE WHEN DATE(d.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE THEN 1 END) as downloads_today
FROM public.profiles p
JOIN public.downloads d ON d.user_id = p.id
WHERE d.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.email, p.full_name
ORDER BY total_downloads DESC
LIMIT 20;
```

---

## 📈 Monitoramento

### Métricas Principais

#### 1. Taxa de Downloads Bloqueados

**Objetivo**: Monitorar quantos downloads foram bloqueados por limite excedido.

**Query**:
```sql
-- Downloads bloqueados hoje (via API logs ou tabela de tentativas)
-- Nota: Esta métrica requer tabela adicional ou logs da API
```

**Métrica Alternativa**: Verificar logs da API para status 403.

**Alerta**: Se > 10% dos downloads estão sendo bloqueados, considerar:
- Aumentar limites dos planos
- Melhorar comunicação sobre limites
- Oferecer upgrade de plano

---

#### 2. Taxa de Cache Hit

**Objetivo**: Monitorar eficiência do cache.

**Verificação**: Header `X-Cache-Status` nas respostas da API.

**Métrica Esperada**: > 70% de cache hits

**Alerta**: Se < 50%, verificar:
- TTL do cache está muito curto?
- Cache está sendo invalidado muito frequentemente?
- Volume de requisições muito alto?

---

#### 3. Tempo Médio de Resposta

**Objetivo**: Monitorar performance da API.

**Endpoints para Monitorar**:
- `POST /api/download`: < 500ms
- `GET /api/downloads/status`: < 200ms

**Alerta**: Se tempo médio > 1s:
- Verificar índices do banco
- Verificar se cache está funcionando
- Verificar carga do servidor

---

#### 4. Rate Limit Hits

**Objetivo**: Monitorar quantas vezes o rate limiting foi acionado.

**Verificação**: Logs da API para status 429.

**Métrica Esperada**: < 1% das requisições

**Alerta**: Se > 5%:
- Verificar se há ataque/bot
- Considerar aumentar limites (se legítimo)
- Verificar se múltiplos usuários estão atrás do mesmo IP

---

#### 5. Erros 500

**Objetivo**: Monitorar erros internos.

**Métrica Esperada**: < 0.1% das requisições

**Alerta**: Se > 1%:
- Investigar logs de erro imediatamente
- Verificar migrations aplicadas
- Verificar conectividade com banco de dados

---

## 🔔 Alertas Recomendados

### Alertas Críticos (Ação Imediata)

1. **Taxa de erros 500 > 1%**
   - Investigar logs
   - Verificar saúde do banco de dados
   - Verificar migrations

2. **Tempo de resposta > 2s**
   - Verificar performance do banco
   - Verificar se índices estão sendo usados
   - Verificar carga do servidor

3. **Sistema de downloads inoperante**
   - Verificar se funções SQL existem
   - Verificar conectividade com banco
   - Verificar logs de erro

### Alertas de Atenção (Monitorar)

1. **Taxa de downloads bloqueados > 20%**
   - Analisar padrões de uso
   - Considerar ajustes nos limites

2. **Rate limit hits > 10%**
   - Verificar se há ataque
   - Verificar se limites são adequados

3. **Cache hit rate < 50%**
   - Verificar configuração de cache
   - Considerar ajustar TTL

---

## 📊 Dashboards Recomendados

### Dashboard 1: Visão Geral

- Total de downloads hoje
- Downloads bloqueados hoje
- Taxa de cache hit
- Tempo médio de resposta
- Rate limit hits

### Dashboard 2: Por Plano

- Downloads por plano (Free, Lite, Pro, Ultra)
- Taxa de bloqueio por plano
- Usuários ativos por plano

### Dashboard 3: Performance

- Tempo de resposta por endpoint
- Taxa de cache hit
- Uso de índices
- Carga do banco de dados

---

## 🔍 Análise de Logs

### Logs da API

A API registra os seguintes eventos:

#### ✅ Download Autorizado

```
✅ Download authorized
{
  userId: "...",
  resourceId: "...",
  downloadId: "...",
  ipAddress: "...",
  current_count: 5,
  limit_count: 10,
  remaining: 5,
  duration: "234ms"
}
```

#### ⚠️ Download Bloqueado

```
⚠️ Download blocked: Limit exceeded
{
  userId: "...",
  resourceId: "...",
  current: 10,
  limit: 10
}
```

```
⚠️ Download blocked: Rate limit exceeded
{
  ip: "...",
  retryAfter: 45
}
```

#### ❌ Erros

```
❌ Download failed: [tipo de erro]
{
  userId: "...",
  error: "...",
  details: {...}
}
```

### Consultas de Análise

#### Padrões de Uso por Hora

```sql
SELECT 
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo') as hora,
  COUNT(*) as downloads
FROM public.downloads
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY hora
ORDER BY hora;
```

#### Recursos Mais Baixados

```sql
SELECT 
  r.title,
  r.id,
  COUNT(d.id) as total_downloads,
  COUNT(DISTINCT d.user_id) as unique_users
FROM public.resources r
JOIN public.downloads d ON d.resource_id = r.id
WHERE d.created_at >= NOW() - INTERVAL '30 days'
GROUP BY r.id, r.title
ORDER BY total_downloads DESC
LIMIT 10;
```

---

## 🛡️ Detecção de Abuso

### Sinais de Abuso

1. **Muitos downloads do mesmo IP**
   - Verificar query de downloads por IP acima
   - Limite sugerido: > 50 downloads/24h do mesmo IP

2. **Múltiplos usuários do mesmo IP**
   - Pode ser legítimo (escritório, WiFi público)
   - Mas também pode ser criação de contas falsas

3. **Downloads muito rápidos**
   - Downloads em sequência muito rápida (< 1 segundo entre downloads)
   - Pode indicar bot ou script

### Ações Recomendadas

1. **Bloquear IP temporariamente** (se confirmado abuso)
2. **Revisar contas associadas ao IP**
3. **Aumentar rate limiting** para IPs suspeitos
4. **Adicionar CAPTCHA** para downloads frequentes

---

## 📝 Relatórios Periódicos

### Relatório Diário

- Total de downloads
- Downloads bloqueados
- Taxa de erro
- Performance média

### Relatório Semanal

- Tendências de uso
- Recursos mais populares
- Padrões de uso por plano
- Análise de abuso

### Relatório Mensal

- Crescimento de downloads
- Eficiência do sistema
- Recomendações de otimização

---

## 🔧 Manutenção

### Limpeza de Dados Antigos

```sql
-- Remover downloads com mais de 1 ano (opcional)
DELETE FROM public.downloads
WHERE created_at < NOW() - INTERVAL '1 year';
```

**⚠️ Atenção**: Antes de deletar, fazer backup!

### Otimização de Índices

```sql
-- Analisar uso de índices
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM public.downloads
WHERE user_id = 'user-id'::UUID
  AND created_at >= CURRENT_DATE::TIMESTAMP;
```

### Vacuum e Analyze

```sql
-- Manutenção periódica (executar mensalmente)
VACUUM ANALYZE public.downloads;
```

---

## 📞 Contato para Problemas

Em caso de problemas críticos:
1. Verificar logs do servidor
2. Verificar logs do Supabase
3. Consultar documentação técnica
4. Revisar métricas de monitoramento


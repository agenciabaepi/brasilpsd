# 📚 Documentação - Sistema de Downloads

## 📖 Índice

1. [Documentação da API](./DOWNLOAD_SYSTEM_API.md) - Endpoints, validações, segurança
2. [Documentação SQL](./DOWNLOAD_SYSTEM_SQL.md) - Funções, triggers, índices
3. [Checklist de Deploy](./DEPLOY_CHECKLIST.md) - Guia completo de deploy
4. [Auditoria e Monitoramento](./AUDIT_AND_MONITORING.md) - Logs, métricas, alertas
5. [Testes de Segurança](../../TESTES_SEGURANCA_DOWNLOADS.md) - Cenários de teste
6. [Sistema de Desenvolvimento](../../DOWNLOAD_SECURITY_SYSTEM.md) - Visão geral do projeto

---

## 🚀 Início Rápido

### Para Desenvolvedores

1. **Leia a documentação da API**: [DOWNLOAD_SYSTEM_API.md](./DOWNLOAD_SYSTEM_API.md)
2. **Entenda as funções SQL**: [DOWNLOAD_SYSTEM_SQL.md](./DOWNLOAD_SYSTEM_SQL.md)
3. **Execute os testes**: [TESTES_SEGURANCA_DOWNLOADS.md](../../TESTES_SEGURANCA_DOWNLOADS.md)

### Para Deploy

1. **Siga o checklist**: [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)
2. **Aplique as migrations** na ordem: 033 → 034 → 035 → 036 → 037
3. **Teste em staging** antes de produção
4. **Monitore logs** após deploy

---

## 🔑 Conceitos Principais

### Limites por Plano

| Plano | Downloads/Dia |
|-------|---------------|
| Free  | 1             |
| Lite  | 3             |
| Pro   | 10            |
| Ultra | 20            |

### Camadas de Segurança

1. **Frontend**: Validação visual e desabilitação de botão
2. **API Route**: Autenticação, rate limiting, validação de parâmetros
3. **Database RPC**: Validação atômica com locks (`FOR UPDATE`)
4. **Database Trigger**: Validação adicional antes de inserir

### Timezone

- Todos os cálculos usam `America/Sao_Paulo`
- Reset do contador à meia-noite (horário de Brasília)

---

## 📊 Arquitetura

```
┌─────────────┐
│  Frontend   │ → Exibe status, desabilita botão
└──────┬──────┘
      │
      ▼
┌─────────────┐
│  API Route  │ → Rate limiting, autenticação, cache
└──────┬──────┘
      │
      ▼
┌─────────────┐
│  Database   │ → Validação atômica, locks, triggers
│    RPC      │
└─────────────┘
```

---

## 🛠️ Ferramentas e Utilitários

### Rate Limiting
- **Arquivo**: `lib/utils/rate-limit.ts`
- **Limites**: 20 req/min, 100 req/hora por IP
- **Armazenamento**: Memória (em produção, considerar Redis)

### Cache
- **Arquivo**: `lib/utils/cache.ts`
- **TTL**: 30 segundos
- **Invalidação**: Automática após cada download

---

## 📝 Migrations

### Ordem de Aplicação

1. **033**: Estrutura base, funções de contagem, índices
2. **034**: Funções de validação, triggers, RLS
3. **035**: Correção de validação redundante
4. **036**: Fallback para `created_at`
5. **037**: Correção de ambiguidade de coluna

### Verificação

```sql
-- Verificar se funções foram criadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%download%';

-- Verificar índices
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'downloads';
```

---

## 🐛 Troubleshooting Comum

### "Sistema de downloads não configurado"
→ Aplicar migrations 033-037

### "Limite excedido" mas usuário não fez downloads
→ Verificar timezone e função `count_user_downloads_today`

### Contador não atualiza
→ Verificar cache e evento `download-completed`

### Performance lenta
→ Verificar índices e cache

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Consultar documentação específica
2. Verificar logs do servidor
3. Revisar migrations aplicadas
4. Consultar testes de segurança

---

## 📅 Histórico de Versões

- **v1.0.0**: Sistema inicial de downloads com limites por plano
- **v1.1.0**: Adicionado rate limiting e cache
- **v1.2.0**: Melhorias de mensagens e notificações

---

## 🔒 Segurança

### Boas Práticas Implementadas

- ✅ Validação em múltiplas camadas
- ✅ Transações atômicas com locks
- ✅ Rate limiting por IP
- ✅ Auditoria completa (IP, User Agent)
- ✅ Cache com invalidação adequada
- ✅ RLS policies ativas

### Pontos de Atenção

- ⚠️ Em produção com múltiplas instâncias, usar Redis para rate limiting e cache
- ⚠️ Monitorar logs de auditoria regularmente
- ⚠️ Revisar limites de rate limiting conforme necessário


# Teste de Assinatura Expirada

## Como Testar

### 1. Usar o endpoint de debug

Acesse no navegador (como admin):
```
http://localhost:3000/api/debug/subscription-check?userId=SEU_USER_ID
```

Isso vai mostrar:
- Todas as assinaturas do usuário
- Comparação detalhada de datas
- Se está detectando como expirada
- Recomendações

### 2. Alterar data de uma assinatura no banco

```sql
-- Ver assinaturas do usuário
SELECT id, user_id, tier, status, current_period_end, created_at 
FROM subscriptions 
WHERE user_id = 'SEU_USER_ID';

-- Alterar para uma data no passado (ex: 22/12/2025 se hoje é 25/12/2025)
UPDATE subscriptions 
SET current_period_end = '2025-12-22' 
WHERE user_id = 'SEU_USER_ID' AND status = 'active';
```

### 3. Tentar fazer download

Depois de alterar a data, tente fazer um download. O sistema deve:
- Detectar que a assinatura expirou
- Bloquear o download
- Retornar erro: "Sua assinatura expirou"

### 4. Verificar logs no console

No terminal onde está rodando `npm run dev`, você deve ver:
```
🔍 Verificando assinatura para usuário: [ID]
📅 Data de hoje (BR): 2025-12-25
📋 Assinaturas encontradas: 1
  - Assinatura [ID]: period_end="2025-12-22", hoje="2025-12-25", expirada=true
⚠️ Assinatura expirada detectada, bloqueando usuário: ...
```

## Problemas Comuns

### Data não está sendo comparada corretamente
- Verificar se o formato está como 'YYYY-MM-DD'
- Verificar se não há timezone issues
- Usar o endpoint de debug para ver os valores exatos

### Assinatura não está sendo bloqueada
- Verificar se o status está como 'active'
- Verificar se a query está retornando a assinatura
- Verificar logs no console


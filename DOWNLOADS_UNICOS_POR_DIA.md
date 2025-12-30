# Sistema de Downloads Únicos por Dia

## 📋 Resumo

Este sistema implementa a lógica onde:
- ✅ **Múltiplos downloads do mesmo arquivo no mesmo dia contam apenas como 1 download**
- ✅ **Se atingir o limite, não pode baixar mais nenhum arquivo, mesmo que tenha baixado o mesmo arquivo naquele dia**
- ✅ **Se baixar um arquivo que foi baixado no dia anterior, conta como novo download**

## 🗂️ Estrutura Implementada

### 1. Migration: `047_implement_unique_downloads_per_day.sql`

#### Funções Criadas/Atualizadas:

**a) `has_user_downloaded_resource_today(p_user_id, p_resource_id)`**
- Verifica se o usuário já baixou o recurso específico hoje
- Retorna `true` se já baixou, `false` caso contrário
- Usa timezone `America/Sao_Paulo` para determinar o "dia"

**b) `count_unique_resources_downloaded_today(p_user_id)`**
- Conta quantos **recursos únicos** o usuário baixou hoje
- Usa `COUNT(DISTINCT resource_id)` para garantir que múltiplos downloads do mesmo recurso contem apenas como 1
- Substitui a contagem anterior que contava todos os downloads

**c) `count_user_downloads_today(p_user_id)` (Atualizada)**
- Agora chama `count_unique_resources_downloaded_today`
- Mantém compatibilidade com código existente

**d) `register_download(p_user_id, p_resource_id, p_ip_address, p_user_agent)` (Atualizada)**
- **Nova lógica:**
  1. Verifica se o recurso já foi baixado hoje
  2. Se **SIM**: Permite o download mas **NÃO conta como novo** (não verifica limite)
  3. Se **NÃO**: Verifica limite ANTES de inserir, e conta como novo download
  4. Retorna campo `is_new_download` indicando se foi novo ou re-download

#### Índice Criado:

**`idx_downloads_user_resource_date`**
- Otimiza consultas para verificar se usuário já baixou recurso específico hoje
- Índice composto: `(user_id, resource_id, DATE(...))`

### 2. Atualizações no Código

#### `lib/utils/downloads.ts`
- Função `getDownloadStatus()` atualizada para usar `count_unique_resources_downloaded_today`
- Agora conta recursos únicos ao invés de downloads totais

#### `app/api/download/route.ts`
- Atualizado para lidar com o campo `is_new_download` retornado pela função
- Logs incluem informação se foi novo download ou re-download
- Resposta da API inclui `is_new_download` e mensagem apropriada

## 🔄 Fluxo de Funcionamento

### Cenário 1: Primeiro download do recurso no dia
```
1. Usuário tenta baixar recurso X
2. Sistema verifica: já baixou X hoje? → NÃO
3. Sistema verifica limite: tem downloads restantes? → SIM
4. Sistema registra download e CONTA como novo
5. Contador de recursos únicos aumenta: 1 → 2
```

### Cenário 2: Re-download do mesmo recurso no mesmo dia
```
1. Usuário tenta baixar recurso X novamente (já baixou hoje)
2. Sistema verifica: já baixou X hoje? → SIM
3. Sistema PERMITE o download mas NÃO verifica limite
4. Sistema registra download mas NÃO conta como novo
5. Contador de recursos únicos permanece: 2 (não aumenta)
```

### Cenário 3: Limite atingido, tentando baixar novo recurso
```
1. Usuário já baixou 10 recursos únicos hoje (limite do plano Pro)
2. Usuário tenta baixar recurso Y (novo, nunca baixado hoje)
3. Sistema verifica: já baixou Y hoje? → NÃO
4. Sistema verifica limite: tem downloads restantes? → NÃO (10/10)
5. Sistema BLOQUEIA o download
6. Mensagem: "Limite de downloads excedido"
```

### Cenário 4: Limite atingido, tentando re-baixar recurso já baixado
```
1. Usuário já baixou 10 recursos únicos hoje (limite do plano Pro)
2. Usuário tenta baixar recurso X novamente (já baixou hoje)
3. Sistema verifica: já baixou X hoje? → SIM
4. Sistema PERMITE o download (não verifica limite para re-downloads)
5. Sistema registra download mas NÃO conta como novo
6. Contador permanece: 10 (não aumenta)
```

### Cenário 5: Download de recurso baixado no dia anterior
```
1. Usuário baixou recurso X ontem
2. Hoje, usuário tenta baixar recurso X novamente
3. Sistema verifica: já baixou X hoje? → NÃO (foi ontem)
4. Sistema verifica limite: tem downloads restantes? → SIM
5. Sistema registra download e CONTA como novo
6. Contador de recursos únicos aumenta
```

## 📊 Exemplo Prático

### Dia 1 (30/12/2025)
- 08:00 - Download Recurso A → Conta como 1 (novo)
- 10:00 - Download Recurso B → Conta como 2 (novo)
- 12:00 - Download Recurso A novamente → NÃO conta (já baixado hoje)
- 14:00 - Download Recurso C → Conta como 3 (novo)
- **Total: 3 recursos únicos baixados**

### Dia 2 (31/12/2025)
- 09:00 - Download Recurso A → Conta como 1 (novo, foi ontem)
- 11:00 - Download Recurso B → Conta como 2 (novo, foi ontem)
- 13:00 - Download Recurso A novamente → NÃO conta (já baixado hoje)
- **Total: 2 recursos únicos baixados**

## 🔐 Segurança

- ✅ Validação de limite ANTES de inserir (previne race conditions)
- ✅ Lock na linha do usuário durante verificação (atomicidade)
- ✅ Double-check após inserção (proteção adicional)
- ✅ Transação atômica (rollback se necessário)
- ✅ Timezone consistente (America/Sao_Paulo)

## 📝 Como Aplicar

1. **Aplicar a migration no Supabase:**
   ```sql
   -- Executar o arquivo:
   supabase/migrations/047_implement_unique_downloads_per_day.sql
   ```

2. **Verificar se as funções foram criadas:**
   ```sql
   SELECT proname FROM pg_proc 
   WHERE proname IN (
     'has_user_downloaded_resource_today',
     'count_unique_resources_downloaded_today'
   );
   ```

3. **Testar a funcionalidade:**
   - Baixar um recurso pela primeira vez no dia
   - Tentar baixar o mesmo recurso novamente (deve permitir mas não contar)
   - Verificar contador de downloads (deve permanecer igual)
   - Baixar um novo recurso (deve contar como novo)

## 🎯 Benefícios

1. **Experiência do usuário melhorada**: Pode re-baixar arquivos sem consumir limite
2. **Controle preciso**: Limite baseado em recursos únicos, não downloads totais
3. **Prevenção de abuso**: Limite ainda é respeitado para novos recursos
4. **Auditoria completa**: Todos os downloads são registrados, mas apenas únicos contam

## ⚠️ Observações Importantes

- O sistema **sempre registra** o download no banco (para auditoria)
- Apenas a **contagem** considera recursos únicos
- O limite é verificado **apenas para novos downloads**
- Re-downloads do mesmo recurso no mesmo dia **não consomem limite**
- Downloads de recursos baixados em dias anteriores **contam como novos**


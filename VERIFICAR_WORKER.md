# 🔍 Verificar se o Worker Está Processando

## ✅ Status Atual

- ✅ Worker rodando sem erros (`🔄 Polling SQS queue...`)
- ✅ Upload concluído com sucesso
- ✅ Recurso salvo no banco: `933914db-2e4d-4ff5-8345-239e04ae6dae`

## 🔍 O que verificar agora:

### 1. Ver logs do worker

No terminal onde o worker está rodando, você deve ver algo como:

```
📨 Mensagem recebida: [algum-id]
🔄 Processando vídeo: { 
  resourceId: '933914db-2e4d-4ff5-8345-239e04ae6dae',
  key: 'resources/1767068058543-hnmsae.mov',
  fileName: '...',
  ...
}
⬇️ Baixando arquivo do S3...
```

**Se você NÃO vê isso**, significa que a mensagem não foi enfileirada.

### 2. Verificar se a mensagem foi enfileirada

O código deve:
1. Fazer upload do arquivo para S3
2. Chamar `/api/upload/process` (primeira vez, sem resourceId)
3. Salvar no banco
4. Chamar `/api/upload/process` novamente (com resourceId) ← **Esta é a importante!**

### 3. Verificar console do navegador

No console do navegador (F12), procure por:
- `📤 Re-enfileirando processamento com resourceId...`
- `✅ Processamento re-enfileirado com resourceId: 933914db-2e4d-4ff5-8345-239e04ae6dae`

**Se você NÃO vê essas mensagens**, o código não está re-enfileirando.

### 4. Verificar se há erros

No console do navegador, procure por erros relacionados a:
- `/api/upload/process`
- `enqueueVideoProcessing`
- SQS

## 🐛 Possíveis Problemas:

### Problema 1: Mensagem não foi enfileirada
**Sintoma**: Worker não mostra "📨 Mensagem recebida"
**Causa**: API não está enfileirando ou há erro silencioso
**Solução**: Verificar logs do servidor Next.js

### Problema 2: Re-enfileiramento não aconteceu
**Sintoma**: Não vê "📤 Re-enfileirando" no console
**Causa**: Código não está executando ou `fileData.processing !== 'queued'`
**Solução**: Verificar se `fileData.processing === 'queued'` está correto

### Problema 3: Permissão SQS SendMessage
**Sintoma**: Erro ao enfileirar (mas worker recebe OK)
**Causa**: Usuário IAM não tem `sqs:SendMessage`
**Solução**: Adicionar `sqs:SendMessage` na política IAM

## ✅ Teste Rápido:

1. **Faça upload de outro vídeo** (pequeno, para testar)
2. **Observe o console do navegador** - deve aparecer:
   ```
   📤 Re-enfileirando processamento com resourceId...
   ✅ Processamento re-enfileirado com resourceId: [id]
   ```
3. **Observe os logs do worker** - deve aparecer:
   ```
   📨 Mensagem recebida: [message-id]
   🔄 Processando vídeo: ...
   ```

## 📝 Nota:

O código foi atualizado para re-enfileirar após salvar no banco. Se você fez upload ANTES dessa atualização, o vídeo pode não ter sido enfileirado. Faça um novo upload para testar!


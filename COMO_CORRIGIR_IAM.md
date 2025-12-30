# 🔐 Como Corrigir Permissões IAM - Passo a Passo Visual

## ❌ Problema

O worker está mostrando este erro:
```
AccessDenied: User: arn:aws:iam::641791054341:user/api-brasilpsd 
is not authorized to perform: sqs:receivemessage
```

## ✅ Solução Rápida (5 minutos)

### Passo 1: Acessar IAM
1. Vá para: https://console.aws.amazon.com/iam/
2. No menu lateral esquerdo, clique em **Users**

### Passo 2: Encontrar o Usuário
1. Na lista de usuários, procure por: **api-brasilpsd**
2. Clique no nome do usuário (não no checkbox)

### Passo 3: Adicionar Permissão
1. Você verá abas no topo: **Permissions**, **Groups**, etc.
2. Clique na aba **Permissions**
3. Você verá uma seção com botões, procure por **Add permissions**
4. Clique em **Add permissions**
5. No dropdown que aparece, escolha: **Create inline policy**

### Passo 4: Configurar a Política
1. Você verá uma tela para criar política
2. Clique na aba **JSON** (ao invés de Visual)
3. **APAGUE** todo o conteúdo que está lá
4. **COLE** este JSON abaixo:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "arn:aws:sqs:us-east-2:641791054341:video-processing-queue"
    }
  ]
}
```

5. Clique no botão **Next** (ou **Review policy**)

### Passo 5: Dar Nome e Criar
1. Em **Policy name**, digite: `VideoWorkerSQSAccess`
2. Clique em **Create policy**

### Passo 6: Verificar
1. Você deve voltar para a página do usuário
2. Na aba **Permissions**, você deve ver a nova política: `VideoWorkerSQSAccess`

## ✅ Pronto!

Agora:
1. **Pare o worker** (pressione `Ctrl+C` no terminal onde está rodando)
2. **Reinicie o worker**: `npm start` (no diretório `worker/`)
3. Os erros de `AccessDenied` devem desaparecer!

## 🔍 Verificar se Funcionou

Você deve ver nos logs do worker:

```
🚀 Worker iniciado
📋 Configuração: { ... }
🔄 Polling SQS queue...
```

**SEM** os erros `AccessDenied` repetindo.

Se ainda aparecer o erro, aguarde alguns segundos (as permissões podem demorar alguns segundos para propagar na AWS).

## 📝 Nota

Esta política dá permissão para:
- ✅ `sqs:ReceiveMessage` - Receber mensagens da fila (worker)
- ✅ `sqs:DeleteMessage` - Deletar mensagens após processar (worker)
- ✅ `sqs:GetQueueAttributes` - Ver informações da fila (worker)
- ✅ `sqs:SendMessage` - Enviar mensagens para a fila (API Next.js)
- ✅ `sqs:GetQueueUrl` - Obter URL da fila

**Seguro**: A política é restrita apenas à fila `video-processing-queue` específica.


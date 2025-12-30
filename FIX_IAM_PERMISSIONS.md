# 🔐 Corrigir Permissões IAM para SQS

O worker está mostrando erro de permissão. O usuário IAM `api-brasilpsd` não tem permissão para acessar a fila SQS.

## ❌ Erro Atual

```
AccessDenied: User: arn:aws:iam::641791054341:user/api-brasilpsd 
is not authorized to perform: sqs:receivemessage 
on resource: arn:aws:sqs:us-east-2:641791054341:video-processing-queue
```

## ✅ Solução: Adicionar Permissões SQS ao IAM User

### Passo 1: Acessar IAM no AWS Console

1. Vá para: https://console.aws.amazon.com/iam/
2. No menu lateral, clique em **Users**
3. Procure pelo usuário: `api-brasilpsd`
4. Clique no nome do usuário

### Passo 2: Adicionar Política SQS

1. Na aba **Permissions**, clique em **Add permissions** → **Create inline policy**
2. Clique na aba **JSON**
3. Cole o JSON abaixo:

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

4. Clique em **Next**
5. Nome da política: `VideoWorkerSQSAccess`
6. Clique em **Create policy**

### Passo 3: Verificar

Após adicionar a política, o worker deve conseguir:
- ✅ Receber mensagens da fila (`sqs:ReceiveMessage`)
- ✅ Deletar mensagens após processar (`sqs:DeleteMessage`)
- ✅ Ver atributos da fila (`sqs:GetQueueAttributes`)

E a API do Next.js (que também usa o mesmo usuário) pode:
- ✅ Enviar mensagens para a fila (`sqs:SendMessage`)

## 🔍 Nota

O usuário `api-brasilpsd` também precisa de permissões S3 (que já deve ter). Se não tiver, adicione também:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject"
  ],
  "Resource": "arn:aws:s3:::brasilpsd-arquivos/*"
}
```

## ✅ Após Corrigir

1. Pare o worker (Ctrl+C se estiver rodando)
2. Reinicie o worker: `npm start` (no diretório `worker/`)
3. Você deve ver logs normais sem erros de AccessDenied


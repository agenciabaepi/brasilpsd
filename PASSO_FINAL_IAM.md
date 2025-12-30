# ✅ Último Passo - Criar Política Inline

## Você está na tela correta! 🎯

Vejo que você está na aba **"Permissões"** e há um botão **"Adicionar permissões"** com uma seta para baixo.

## Passos finais:

### 1. Clique no botão "Adicionar permissões"

1. Procure pelo botão **"Adicionar permissões"** (está acima da tabela, à direita)
2. Ele tem uma **seta para baixo** ⬇️ indicando que é um menu dropdown
3. **Clique** nesse botão

### 2. Escolha a opção correta

Quando você clicar, um menu deve aparecer com opções. Procure por:

- ✅ **"Create inline policy"** ou **"Criar política inline"** ou **"Add inline policy"**

**OU**

Se o menu mostrar estas opções:
- ❌ "Add user to group" - NÃO escolha essa
- ❌ "Copy permissions" - NÃO escolha essa
- ❌ "Attach policies directly" - NÃO escolha essa (essa anexa políticas existentes)
- ✅ **"Create inline policy"** ou similar - **ESCOLHA ESTA!**

### 3. Se não aparecer menu dropdown:

1. Clique diretamente no botão "Adicionar permissões" (sem esperar menu)
2. Você deve ir para uma nova página
3. Nessa nova página, procure por **"Create inline policy"** ou **"Add inline policy"**

### 4. Quando encontrar "Create inline policy":

1. Você verá uma tela para criar a política
2. Procure por 3 abas ou opções:
   - **Visual editor** (Editor visual)
   - **JSON** ← **CLIQUE AQUI!**
3. Clique na aba **"JSON"**
4. **APAGUE** todo o conteúdo que está lá
5. **COLE** este JSON:

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

6. Clique em **"Next"** ou **"Review policy"**
7. Nome da política: `VideoWorkerSQSAccess`
8. Clique em **"Create policy"**

## ✅ Pronto!

Após criar a política:
1. Você voltará para a página do usuário
2. Na tabela de políticas, você deve ver duas políticas:
   - AmazonS3FullAccess (já existente)
   - **VideoWorkerSQSAccess** (nova!)

3. Pare o worker (Ctrl+C) e reinicie: `npm start` no diretório `worker/`

## 🔍 Dica:

Se você não encontrar a opção "Create inline policy", pode estar em outro lugar. Tente:
- Clicar diretamente no botão "Adicionar permissões"
- Ou procurar por um link/texto que mencione "inline policy" ou "custom policy"


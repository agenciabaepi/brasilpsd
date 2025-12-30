# 🔐 Corrigir IAM - Passo a Passo CORRETO

## ⚠️ IMPORTANTE: Você está na opção errada!

A tela que você está vendo agora é para **anexar políticas gerenciadas pela AWS**. 
Precisamos **criar uma política inline personalizada**.

## ✅ Passos Corretos:

### 1. Voltar para a página do usuário

1. **Cancele** esta tela atual (botão "Cancel" ou feche a página)
2. Você deve voltar para a página do usuário `api-brasilpsd`
3. Certifique-se de estar na aba **"Permissions"** (Permissões)

### 2. Criar política inline

1. Na aba **"Permissions"**, você verá duas seções:
   - **"Permissions policies"** (Políticas de permissão)
   - **"Add permissions"** (Adicionar permissões)

2. Procure por um botão ou link que diz:
   - **"Add inline policy"** OU
   - **"Create inline policy"** OU
   - **"Add permissions"** → mas depois escolha **"Create inline policy"**

3. **NÃO escolha** "Attach policies directly" (essa é a opção errada!)

### 3. Alternativa: Via botão "Add permissions"

Se você clicar em **"Add permissions"**, você verá 3 opções:

- ❌ **"Add user to group"** - NÃO é essa
- ❌ **"Copy permissions"** - NÃO é essa  
- ❌ **"Attach policies directly"** - NÃO é essa (esta é a que você está vendo agora)

**O que você precisa:**
- Procure por um botão ou link **"Create inline policy"** OU
- Vá para a seção de **"Inline policies"** na página do usuário

### 4. Como chegar na tela correta:

**Método 1 (Mais direto):**
1. Na página do usuário `api-brasilpsd`
2. Aba **"Permissions"**
3. Role a página até ver a seção **"Permissions policies"**
4. Procure por **"Add permissions"** → Clique
5. Você verá um dropdown ou opções:
   - Procure por **"Create inline policy"** ou **"Add inline policy"**
   - Se não aparecer, pode estar em uma seção separada chamada **"Inline policies"**

**Método 2 (Se não encontrar):**
1. Na página do usuário `api-brasilpsd`
2. Aba **"Permissions"**
3. Role até o final da página
4. Procure por uma seção chamada **"Inline policies"** ou **"Permissions policies"**
5. Deve haver um botão **"Add inline policy"** ou similar

### 5. Quando encontrar "Create inline policy":

1. Clique em **"Create inline policy"**
2. Você verá uma tela com 3 opções:
   - **Visual editor** (Editor visual)
   - **JSON** ← **ESCOLHA ESTA!**
3. Clique na aba **"JSON"**
4. **APAGUE** todo o conteúdo
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
7. Nome: `VideoWorkerSQSAccess`
8. Clique em **"Create policy"**

## 🔍 Diferença importante:

- ❌ **"Attach policies directly"** = Anexar políticas que já existem (gerenciadas pela AWS)
- ✅ **"Create inline policy"** = Criar uma política personalizada nova (é o que precisamos!)

## 💡 Dica:

Se ainda não encontrar, tente:
1. Na página do usuário, use a busca (Ctrl+F / Cmd+F)
2. Busque por: "inline" ou "create policy"
3. Isso vai destacar onde está o botão


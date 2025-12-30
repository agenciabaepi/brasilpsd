# ✅ Testar o Worker Agora

## 🎉 Política Criada!

Agora que você criou a política `VideoWorkerSQSAccess`, vamos testar!

## 🔄 Passo 1: Reiniciar o Worker

### Se o worker estiver rodando:

1. Vá para o terminal onde o worker está rodando
2. Pressione **`Ctrl+C`** para parar o worker
3. Você deve ver que o processo parou

### Se o worker não estiver rodando:

Não precisa fazer nada neste passo.

## 🚀 Passo 2: Iniciar o Worker

No terminal, execute:

```bash
cd worker
npm start
```

## ✅ Passo 3: Verificar se Funcionou

Você deve ver nos logs:

```
🚀 Worker iniciado
📋 Configuração: {
  region: 'us-east-2',
  bucket: 'brasilpsd-arquivos',
  queue: 'https://sqs.us-east-2.amazonaws.com/641791054341/video-processing-queue'
}
🔄 Polling SQS queue...
```

**IMPORTANTE:** 
- ✅ NÃO deve aparecer mais os erros `AccessDenied`
- ✅ Deve aparecer apenas "🔄 Polling SQS queue..." repetindo (isso é normal, significa que está procurando mensagens)

## 🧪 Passo 4: Testar com Upload Real

1. Acesse a página de upload do sistema
2. Faça upload de um vídeo
3. O upload deve ser rápido (não espera processamento)
4. Veja os logs do worker - deve mostrar processamento do vídeo!

## 📝 O que você deve ver nos logs do worker:

Quando um vídeo for processado:

```
📨 Mensagem recebida: [message-id]
🔄 Processando vídeo: { resourceId: '...', key: '...', fileName: '...' }
⬇️ Baixando arquivo do S3...
✅ Arquivo baixado: [tamanho] bytes
📊 Extraindo metadados...
✅ Metadados: { ... }
🎬 Convertendo para MP4...
✅ MP4 convertido: [tamanho] bytes
✅ MP4 enviado para S3: [url]
🎬 Gerando preview...
✅ Preview gerado: [tamanho] bytes
✅ Preview enviado para S3: [url]
🖼️ Extraindo thumbnail...
✅ Thumbnail extraído: [tamanho] bytes
✅ Thumbnail enviado para S3: [url]
🗑️ Deletando arquivo original temporário do S3...
✅ Arquivo original temporário deletado do S3
💾 Atualizando banco de dados...
✅ Banco de dados atualizado
✅ Processamento concluído com sucesso!
✅ Mensagem processada e removida da fila
```

## ❌ Se ainda aparecer erro:

Se ainda aparecer `AccessDenied`:
1. Aguarde alguns segundos (permissões podem levar alguns segundos para propagar)
2. Verifique se a política foi realmente criada:
   - Volte para a página do usuário `api-brasilpsd`
   - Aba "Permissions"
   - Deve aparecer 2 políticas:
     - AmazonS3FullAccess
     - VideoWorkerSQSAccess (a nova!)
3. Se não aparecer, tente criar novamente

## ✅ Tudo Funcionando?

Se você vê apenas "🔄 Polling SQS queue..." sem erros, está tudo certo! 
O worker está esperando vídeos para processar! 🎉


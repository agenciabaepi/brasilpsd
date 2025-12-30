# 📁 Estrutura de Pastas no S3

## ✅ Estrutura Correta (Implementada)

### Vídeo Original (Após Conversão)
```
resources/{userId}/{timestamp}-{randomId}.mp4
```
- **Onde**: `resources/` → pasta do criador (`{userId}`)
- **Formato**: MP4 (convertido do formato original)
- **Exemplo**: `resources/4fcdbfce-ea01-4a86-ad02-ec24dc6f3758/1735581234567-abc123.mp4`

### Preview do Vídeo
```
video-previews/{userId}/{timestamp}-{randomId}.mp4
```
- **Onde**: `video-previews/` → pasta do criador (`{userId}`)
- **Formato**: MP4 leve (otimizado para web)
- **Exemplo**: `video-previews/4fcdbfce-ea01-4a86-ad02-ec24dc6f3758/video-preview-1735581234567-xyz789.mp4`

### Thumbnail
```
thumbnails/{userId}/{timestamp}-{randomId}.jpg
```
- **Onde**: `thumbnails/` → pasta do criador (`{userId}`)
- **Formato**: JPG
- **Exemplo**: `thumbnails/4fcdbfce-ea01-4a86-ad02-ec24dc6f3758/thumb-1735581234567-def456.jpg`

## 🔄 Fluxo de Processamento

1. **Upload Inicial** (temporário):
   ```
   resources/{timestamp}-{randomId}.mov  (ou outro formato)
   ```
   - Arquivo original enviado diretamente para S3
   - Fica em `resources/` (sem userId) temporariamente

2. **Worker Processa**:
   - ✅ Baixa arquivo original de `resources/{timestamp}-{randomId}.mov`
   - ✅ Converte para MP4
   - ✅ Salva MP4 em `resources/{userId}/{timestamp}-{randomId}.mp4`
   - ✅ Gera preview e salva em `video-previews/{userId}/{timestamp}-{randomId}.mp4`
   - ✅ Extrai thumbnail e salva em `thumbnails/{userId}/{timestamp}-{randomId}.jpg`
   - ✅ **Deleta arquivo original temporário** de `resources/{timestamp}-{randomId}.mov`

3. **Resultado Final**:
   - MP4 convertido: `resources/{userId}/` ✅
   - Preview: `video-previews/{userId}/` ✅
   - Thumbnail: `thumbnails/{userId}/` ✅
   - Arquivo original temporário: **DELETADO** ✅

## 📝 Notas

- O arquivo original temporário é deletado automaticamente após processamento
- Todos os arquivos finais estão organizados por `userId` (criador)
- O formato final sempre é MP4 (mesmo que o original fosse MOV, AVI, etc.)


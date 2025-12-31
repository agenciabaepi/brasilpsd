# Geração Automática de Thumbnails para Arquivos de Design

Este sistema agora gera **automaticamente** thumbnails para arquivos de design (PSD, AI, EPS, SVG), similar ao que grandes players como **Freepik** e **Envato** fazem.

## Formatos Suportados

- ✅ **PSD** (Photoshop) - Usando biblioteca `psd`
- ✅ **EPS** (Encapsulated PostScript) - Usando Ghostscript
- ✅ **AI** (Illustrator) - Via PDF ou Ghostscript
- ✅ **SVG** (Scalable Vector Graphics) - Usando Sharp
- ✅ **PDF** - Usando Sharp

## Como Funciona

1. **Upload do arquivo**: Usuário faz upload do arquivo original (PSD, AI, EPS, etc.)
2. **Geração automática**: Sistema detecta o formato e gera thumbnail automaticamente
3. **Upload do thumbnail**: Thumbnail é salvo no S3
4. **Preview com marca d'água**: Sistema também cria preview com marca d'água para proteção

## Dependências do Sistema

### Bibliotecas NPM (já instaladas)
- `psd` - Para processar arquivos PSD
- `sharp` - Para processar imagens e SVG

### Ferramentas do Sistema (opcionais, mas recomendadas)

#### Ghostscript (para EPS e AI)
Ghostscript melhora significativamente a qualidade de conversão de arquivos EPS e AI.

**Instalação:**

```bash
# macOS
brew install ghostscript

# Ubuntu/Debian
sudo apt-get install ghostscript

# Windows
# Baixar de: https://www.ghostscript.com/download/gsdnld.html
```

**Verificar instalação:**
```bash
gs --version
```

**Nota:** O sistema funciona sem Ghostscript, mas com qualidade reduzida para EPS/AI (usa fallback com Sharp).

## Fluxo de Processamento

```
Upload → Detecção de Formato → Geração de Thumbnail → Upload S3 → Atualização DB
```

### Para PSD:
1. Parse do arquivo usando biblioteca `psd`
2. Extração da imagem composta (todas as camadas)
3. Redimensionamento e otimização com Sharp
4. Conversão para JPEG

### Para EPS:
1. Verifica se Ghostscript está disponível
2. Se sim: Converte EPS → PNG usando Ghostscript → Processa com Sharp
3. Se não: Tenta processar diretamente com Sharp (fallback)

### Para AI:
1. Tenta processar como PDF (muitos arquivos AI são PDFs)
2. Se falhar, tenta com Ghostscript (similar a EPS)

### Para SVG:
1. Renderiza SVG diretamente com Sharp
2. Converte para JPEG otimizado

## Configuração

As opções padrão de thumbnail são:
- **Largura máxima**: 1200px
- **Altura máxima**: 1200px
- **Qualidade JPEG**: 85%
- **Formato**: JPEG

Essas opções podem ser ajustadas no código em `lib/design/thumbnail.ts`.

## Troubleshooting

### Thumbnail não é gerado
1. Verifique se o formato é suportado
2. Verifique os logs do servidor
3. Para EPS/AI, instale Ghostscript para melhor qualidade

### Erro ao processar PSD
- Verifique se a biblioteca `psd` está instalada: `npm install psd`
- Alguns PSDs muito complexos podem falhar

### Erro ao processar EPS/AI
- Instale Ghostscript: `brew install ghostscript` (macOS) ou `apt-get install ghostscript` (Linux)
- O sistema tentará fallback automático se Ghostscript não estiver disponível

## Performance

- **PSD**: ~2-5 segundos (depende do tamanho e complexidade)
- **EPS**: ~1-3 segundos (com Ghostscript) ou ~0.5-1s (fallback)
- **AI**: ~1-3 segundos (similar a EPS)
- **SVG**: ~0.1-0.5 segundos (muito rápido)

## Melhorias Futuras

- [ ] Suporte para outros formatos vetoriais (CDR, XD, etc.)
- [ ] Processamento assíncrono via worker para arquivos grandes
- [ ] Cache de thumbnails para evitar reprocessamento
- [ ] Múltiplos tamanhos de thumbnail (thumb, medium, large)


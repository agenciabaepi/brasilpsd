import sharp from 'sharp'

export interface ImageMetadata {
  title?: string
  description?: string
  keywords?: string[]
  author?: string
  copyright?: string
  location?: string
  camera?: string
  date?: string
  width?: number
  height?: number
  format?: string
}

/**
 * Extrai metadados de uma imagem (EXIF, IPTC, etc.)
 */
export async function extractImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await sharp(imageBuffer).metadata()
    
    // Extrair informações básicas
    const result: ImageMetadata = {
      width: metadata.width || undefined,
      height: metadata.height || undefined,
      format: metadata.format || undefined,
    }

    // Tentar extrair informações do EXIF se disponível
    if (metadata.exif) {
      const exifData = parseExif(metadata.exif)
      Object.assign(result, exifData)
    }

    // Tentar extrair informações do IPTC se disponível
    if (metadata.iptc) {
      const iptcData = parseIptc(metadata.iptc)
      Object.assign(result, iptcData)
    }

    // Extrair informações adicionais dos metadados do Sharp
    if (metadata.orientation) {
      // Orientation pode ser útil
    }

    // Se tiver informações de data/hora no EXIF
    if (metadata.exif) {
      // Tentar extrair data de criação
      try {
        // Sharp pode ter informações de data em diferentes formatos
        const exifString = metadata.exif.toString('utf8')
        // Procurar por padrões de data
        const dateMatch = exifString.match(/(\d{4}):(\d{2}):(\d{2})/)
        if (dateMatch) {
          result.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        }
      } catch (e) {
        // Ignorar erros de parsing
      }
    }

    return result
  } catch (error: any) {
    console.error('Error extracting image metadata:', error)
    return {}
  }
}

/**
 * Parse EXIF data (Sharp retorna como Buffer, mas podemos tentar extrair informações básicas)
 */
function parseExif(exif: Buffer): Partial<ImageMetadata> {
  const result: Partial<ImageMetadata> = {}
  
  try {
    // Sharp retorna EXIF como Buffer, mas não parseia automaticamente
    // Por enquanto, retornamos vazio - podemos adicionar parsing mais tarde se necessário
    // Para parsing completo, usar biblioteca como 'exif-parser' ou 'piexifjs'
  } catch (error) {
    console.warn('Error parsing EXIF:', error)
  }
  
  return result
}

/**
 * Parse IPTC data (Sharp retorna como Buffer)
 */
function parseIptc(iptc: Buffer): Partial<ImageMetadata> {
  const result: Partial<ImageMetadata> = {}
  
  try {
    // Sharp retorna IPTC como Buffer, mas não parseia automaticamente
    // Por enquanto, retornamos vazio - podemos adicionar parsing mais tarde se necessário
  } catch (error) {
    console.warn('Error parsing IPTC:', error)
  }
  
  return result
}

/**
 * Extrai título dos metadados ou nome do arquivo
 */
function extractTitleFromMetadata(metadata: ImageMetadata, sharpMetadata: any): string {
  // Tentar usar título do IPTC/EXIF
  if (metadata.title) {
    return metadata.title
  }

  // Tentar usar descrição curta
  if (metadata.description && metadata.description.length < 100) {
    return metadata.description
  }

  // Usar nome do arquivo como fallback
  return ''
}

/**
 * Gera descrição a partir dos metadados
 */
function generateDescriptionFromMetadata(metadata: ImageMetadata, sharpMetadata: any): string {
  const parts: string[] = []

  if (metadata.camera) {
    parts.push(`Capturado com ${metadata.camera}`)
  }

  if (metadata.location) {
    parts.push(`Local: ${metadata.location}`)
  }

  if (metadata.date) {
    parts.push(`Data: ${metadata.date}`)
  }

  if (metadata.width && metadata.height) {
    parts.push(`Resolução: ${metadata.width} × ${metadata.height}px`)
  }

  if (metadata.keywords && metadata.keywords.length > 0) {
    parts.push(`Tags: ${metadata.keywords.slice(0, 5).join(', ')}`)
  }

  return parts.join('. ') || ''
}

/**
 * Extrai keywords dos metadados
 */
function extractKeywordsFromMetadata(metadata: ImageMetadata, sharpMetadata: any): string[] {
  const keywords: string[] = []

  if (metadata.keywords) {
    keywords.push(...metadata.keywords)
  }

  // Extrair palavras do título e descrição
  if (metadata.title) {
    const titleWords = metadata.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    keywords.push(...titleWords)
  }

  if (metadata.description) {
    const descWords = metadata.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    keywords.push(...descWords.slice(0, 5))
  }

  // Remover duplicatas
  return [...new Set(keywords)].slice(0, 10)
}


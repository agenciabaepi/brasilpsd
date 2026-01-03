import sharp from 'sharp'

/**
 * Detecta se uma imagem foi gerada por IA baseado em metadados EXIF e padrões comuns
 * 
 * Sinais de imagem gerada por IA:
 * 1. Ausência de metadados EXIF completos (câmera, lente, GPS, etc.)
 * 2. Dimensões muito específicas (múltiplos de 64/128, comum em Stable Diffusion)
 * 3. Ausência de dados de câmera
 * 4. Formato sem metadados ricos
 * 
 * @param buffer Buffer da imagem
 * @returns Objeto com isAiGenerated (boolean) e confidence (0-1)
 */
export async function detectAiGeneratedImage(buffer: Buffer): Promise<{
  isAiGenerated: boolean
  confidence: number
  reasons: string[]
}> {
  const reasons: string[] = []
  let confidence = 0

  try {
    const image = sharp(buffer)
    const metadata = await image.metadata()

    // 1. Verificar metadados EXIF
    const exif = metadata.exif
    const hasCameraData = exif && (
      exif.toString().includes('Make') || // Fabricante da câmera
      exif.toString().includes('Model') || // Modelo da câmera
      exif.toString().includes('Lens') || // Informações da lente
      exif.toString().includes('FocalLength') || // Distância focal
      exif.toString().includes('ISO') || // ISO
      exif.toString().includes('ExposureTime') || // Tempo de exposição
      exif.toString().includes('FNumber') // Abertura
    )

    if (!hasCameraData) {
      confidence += 0.3
      reasons.push('Ausência de metadados de câmera')
    }

    // 2. Verificar GPS (imagens reais geralmente têm GPS se tiradas com smartphone)
    const hasGps = exif && exif.toString().includes('GPS')
    if (!hasGps && metadata.width && metadata.width > 1000) {
      // Imagens grandes sem GPS podem ser geradas por IA
      confidence += 0.1
      reasons.push('Sem dados de localização GPS')
    }

    // 3. Verificar dimensões suspeitas (múltiplos de 64/128 são comuns em IA)
    if (metadata.width && metadata.height) {
      const width = metadata.width
      const height = metadata.height
      
      // Dimensões muito comuns em imagens geradas por IA
      const commonAiDimensions = [
        [512, 512], [768, 768], [1024, 1024], [1280, 1280],
        [512, 768], [768, 512], [1024, 1536], [1536, 1024],
        [1024, 1792], [1792, 1024]
      ]
      
      const isCommonAiDimension = commonAiDimensions.some(
        ([w, h]) => (width === w && height === h) || (width === h && height === w)
      )
      
      if (isCommonAiDimension) {
        confidence += 0.2
        reasons.push(`Dimensões comuns em imagens geradas por IA (${width}x${height})`)
      }

      // Verificar se é múltiplo de 64 (comum em Stable Diffusion)
      if (width % 64 === 0 && height % 64 === 0 && width >= 512) {
        confidence += 0.15
        reasons.push('Dimensões são múltiplos de 64 (padrão em Stable Diffusion)')
      }
    }

    // 4. Verificar formato e qualidade
    // Imagens geradas por IA geralmente são PNG ou JPEG sem compressão avançada
    if (metadata.format === 'png' && metadata.width && metadata.width >= 1024) {
      // PNGs grandes podem ser gerados por IA
      confidence += 0.1
      reasons.push('Formato PNG em alta resolução')
    }

    // 5. Verificar ausência de dados de orientação
    // Imagens reais geralmente têm orientação EXIF
    if (!metadata.orientation && metadata.width && metadata.height) {
      confidence += 0.05
      reasons.push('Sem dados de orientação')
    }

    // 6. Verificar se tem dados de software (Photoshop, etc.)
    const hasSoftware = exif && exif.toString().includes('Software')
    if (!hasSoftware && metadata.width && metadata.width >= 1024) {
      confidence += 0.1
      reasons.push('Sem metadados de software de edição')
    }

    // Limitar confiança máxima
    confidence = Math.min(confidence, 1.0)

    // Considerar como gerada por IA se confiança >= 0.5
    const isAiGenerated = confidence >= 0.5

    return {
      isAiGenerated,
      confidence,
      reasons: reasons.length > 0 ? reasons : ['Metadados insuficientes para determinar']
    }
  } catch (error) {
    console.error('Erro ao detectar imagem gerada por IA:', error)
    return {
      isAiGenerated: false,
      confidence: 0,
      reasons: ['Erro ao analisar imagem']
    }
  }
}


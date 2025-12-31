/**
 * Módulo profissional para geração automática de thumbnails
 * de arquivos de design (PSD, AI, EPS, SVG, etc.)
 * 
 * Similar ao que grandes players como Freepik e Envato fazem
 * 
 * ⚠️ APENAS PARA SERVIDOR - Não pode ser usado no cliente
 */

// Verificar se está rodando no servidor
if (typeof window !== 'undefined') {
  throw new Error('lib/design/thumbnail.ts can only be used on the server side')
}

import sharp from 'sharp'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

interface ThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  width: 1200,
  height: 1200,
  quality: 85,
  format: 'jpeg'
}

/**
 * Verifica se Ghostscript está disponível no sistema
 * Ghostscript é necessário para converter EPS e AI (via PDF)
 */
async function checkGhostscriptAvailable(): Promise<boolean> {
  try {
    await execAsync('gs --version')
    return true
  } catch {
    return false
  }
}

/**
 * Gera thumbnail de arquivo PSD usando a biblioteca psd
 * Extrai a primeira camada visível ou compõe todas as camadas
 */
export async function generatePsdThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer | null> {
  try {
    console.log('🎨 Processing PSD file...')
    
    // Importar psd dinamicamente apenas no servidor
    // Usar eval para evitar análise estática do webpack
    let PSD: any
    try {
      // Usar Function constructor para evitar análise estática
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const requirePsd = new Function('return require("psd")')
      PSD = requirePsd()
      console.log('✅ PSD module loaded successfully')
    } catch (error: any) {
      console.error('❌ Failed to load psd module:', error.message)
      console.error('❌ Error stack:', error.stack)
      return null
    }
    
    if (!PSD) {
      console.error('❌ PSD module is undefined')
      return null
    }
    
    // Parse do arquivo PSD
    let psd: any
    try {
      console.log('📝 Parsing PSD file, size:', buffer.length, 'bytes')
      psd = PSD.fromBuffer(buffer)
      await psd.parse()
      console.log('✅ PSD file parsed successfully')
    } catch (error: any) {
      console.error('❌ Error parsing PSD file:', error.message)
      console.error('❌ Error stack:', error.stack)
      return null
    }
    
    if (!psd || !psd.image) {
      console.error('❌ PSD object or image is invalid')
      return null
    }
    
    // Obter a imagem composta (todas as camadas)
    let image: Buffer
    try {
      image = psd.image.toPng()
      console.log('✅ PSD image extracted, size:', image?.length || 0, 'bytes')
    } catch (error: any) {
      console.error('❌ Error extracting PSD image:', error.message)
      return null
    }
    
    if (!image || image.length === 0) {
      console.warn('⚠️ PSD image is empty')
      return null
    }
    
    // Processar com Sharp para redimensionar e otimizar
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const thumbnail = await sharp(image)
      .resize(opts.width, opts.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer()
    
    console.log('✅ PSD thumbnail generated:', thumbnail.length, 'bytes')
    return thumbnail
  } catch (error: any) {
    console.error('❌ Error generating PSD thumbnail:', error.message)
    return null
  }
}

/**
 * Gera thumbnail de arquivo EPS usando Ghostscript
 * Converte EPS para PNG/JPG usando gs (ghostscript)
 */
export async function generateEpsThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer | null> {
  try {
    console.log('📐 Processing EPS file...')
    
    const gsAvailable = await checkGhostscriptAvailable()
    if (!gsAvailable) {
      console.warn('⚠️ Ghostscript not available, trying Sharp fallback...')
      // Tentar com Sharp (suporte limitado)
      return await generateEpsThumbnailWithSharp(buffer, options)
    }
    
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const tempDir = tmpdir()
    const inputPath = join(tempDir, `eps-input-${Date.now()}.eps`)
    const outputPath = join(tempDir, `eps-output-${Date.now()}.png`)
    
    try {
      // Salvar buffer temporariamente
      await writeFile(inputPath, buffer)
      
      // Converter EPS para PNG usando Ghostscript
      // -dNOPAUSE: não pausar entre páginas
      // -dBATCH: sair após processar
      // -sDEVICE=png16m: dispositivo PNG 24-bit
      // -r150: resolução 150 DPI (ajustável)
      // -dGraphicsAlphaBits=4: anti-aliasing
      // -dTextAlphaBits=4: anti-aliasing de texto
      const resolution = Math.max(150, Math.min(opts.width || 150, 300))
      const gsCommand = `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r${resolution} -dGraphicsAlphaBits=4 -dTextAlphaBits=4 -sOutputFile="${outputPath}" "${inputPath}"`
      
      await execAsync(gsCommand)
      
      // Ler o PNG gerado
      const pngBuffer = await readFile(outputPath)
      
      // Processar com Sharp para redimensionar e converter para JPEG
      const thumbnail = await sharp(pngBuffer)
        .resize(opts.width, opts.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: opts.quality, mozjpeg: true })
        .toBuffer()
      
      // Limpar arquivos temporários
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ])
      
      console.log('✅ EPS thumbnail generated:', thumbnail.length, 'bytes')
      return thumbnail
    } catch (error: any) {
      // Limpar em caso de erro
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ])
      throw error
    }
  } catch (error: any) {
    console.error('❌ Error generating EPS thumbnail:', error.message)
    // Fallback para Sharp
    return await generateEpsThumbnailWithSharp(buffer, options)
  }
}

/**
 * Fallback: tenta gerar thumbnail EPS usando Sharp
 * Sharp tem suporte limitado para EPS
 */
async function generateEpsThumbnailWithSharp(
  buffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer | null> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const thumbnail = await sharp(buffer, { limitInputPixels: false })
      .resize(opts.width, opts.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer()
    
    console.log('✅ EPS thumbnail generated (Sharp fallback):', thumbnail.length, 'bytes')
    return thumbnail
  } catch (error: any) {
    console.error('❌ Sharp fallback failed:', error.message)
    return null
  }
}

/**
 * Gera thumbnail de arquivo AI (Illustrator)
 * Arquivos AI são complexos, tentamos converter via PDF primeiro
 */
export async function generateAiThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer | null> {
  try {
    console.log('🎨 Processing AI (Illustrator) file...')
    
    // Arquivos AI podem ser PDFs ou formato nativo
    // Primeiro, tentamos tratar como PDF
    try {
      const opts = { ...DEFAULT_OPTIONS, ...options }
      const thumbnail = await sharp(buffer, { limitInputPixels: false })
        .resize(opts.width, opts.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: opts.quality, mozjpeg: true })
        .toBuffer()
      
      console.log('✅ AI thumbnail generated (as PDF):', thumbnail.length, 'bytes')
      return thumbnail
    } catch {
      // Se falhar como PDF, tentar com Ghostscript
      const gsAvailable = await checkGhostscriptAvailable()
      if (gsAvailable) {
        return await generateEpsThumbnail(buffer, options) // AI pode ser processado similar a EPS
      }
    }
    
    return null
  } catch (error: any) {
    console.error('❌ Error generating AI thumbnail:', error.message)
    return null
  }
}

/**
 * Gera thumbnail de arquivo SVG
 * Renderiza SVG para imagem rasterizada
 */
export async function generateSvgThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer | null> {
  try {
    console.log('🖼️ Processing SVG file...')
    
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const thumbnail = await sharp(buffer, { limitInputPixels: false })
      .resize(opts.width, opts.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer()
    
    console.log('✅ SVG thumbnail generated:', thumbnail.length, 'bytes')
    return thumbnail
  } catch (error: any) {
    console.error('❌ Error generating SVG thumbnail:', error.message)
    return null
  }
}

/**
 * Função principal: detecta o tipo de arquivo e gera thumbnail automaticamente
 * Similar ao que Freepik/Envato fazem
 */
export async function generateDesignFileThumbnail(
  buffer: Buffer,
  fileExtension: string,
  fileName?: string,
  options: ThumbnailOptions = {}
): Promise<Buffer | null> {
  const ext = fileExtension.toLowerCase().replace('.', '')
  
  console.log(`🔄 Generating thumbnail for ${ext.toUpperCase()} file...`)
  
  try {
    switch (ext) {
      case 'psd':
        return await generatePsdThumbnail(buffer, options)
      
      case 'eps':
        return await generateEpsThumbnail(buffer, options)
      
      case 'ai':
        return await generateAiThumbnail(buffer, options)
      
      case 'svg':
        return await generateSvgThumbnail(buffer, options)
      
      // Outros formatos vetoriais
      case 'pdf':
        // PDF pode ser tratado como imagem
        try {
          const opts = { ...DEFAULT_OPTIONS, ...options }
          return await sharp(buffer, { limitInputPixels: false, pages: 1 })
            .resize(opts.width, opts.height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ quality: opts.quality, mozjpeg: true })
            .toBuffer()
        } catch {
          return null
        }
      
      default:
        console.warn(`⚠️ Unsupported design file format: ${ext}`)
        return null
    }
  } catch (error: any) {
    console.error(`❌ Error processing ${ext} file:`, error.message)
    return null
  }
}

// Função movida para lib/design/formats.ts para evitar problemas de bundle no cliente
// Re-exportar para manter compatibilidade
export { isDesignFileFormatSupported } from './formats'


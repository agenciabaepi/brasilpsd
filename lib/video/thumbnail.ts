import ffmpeg from 'fluent-ffmpeg'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'
import sharp from 'sharp'

// Detectar caminho do FFmpeg
let ffmpegPath: string | null = null
try {
  const path = execSync('which ffmpeg', { encoding: 'utf-8' }).trim()
  if (path) {
    ffmpegPath = path
  }
} catch (error) {
  console.warn('⚠️ Could not detect FFmpeg path')
}

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

/**
 * Extrai um frame do vídeo como thumbnail (tenta múltiplos timestamps para evitar frames pretos)
 * Retorna o buffer da imagem (JPEG) ou null se falhar
 */
export async function extractVideoThumbnail(
  videoBuffer: Buffer,
  videoFormat: string,
  outputFormat: 'jpeg' | 'png' = 'jpeg',
  quality: number = 85
): Promise<Buffer | null> {
  const tempInputPath = join(tmpdir(), `thumb-input-${Date.now()}-${Math.random().toString(36)}.${videoFormat}`)
  const tempOutputPath = join(tmpdir(), `thumb-output-${Date.now()}-${Math.random().toString(36)}.${outputFormat}`)

  try {
    console.log('🖼️ Extracting video thumbnail...', { 
      format: videoFormat,
      inputSize: videoBuffer.length,
      outputFormat
    })
    
    // Salvar buffer em arquivo temporário
    await writeFile(tempInputPath, videoBuffer)
    console.log('✅ Temporary input file created')

    return new Promise((resolve) => {
      const outputDir = tmpdir()
      const outputFilename = `thumb-${Date.now()}-${Math.random().toString(36)}.png`
      const outputPath = join(outputDir, outputFilename)
      
      ffmpeg(tempInputPath)
        .screenshots({
          // Tentar múltiplos timestamps para evitar frames pretos (fade in)
          // Começar em 2 segundos, depois 1 segundo, depois 0.5 segundos como fallback
          timestamps: ['00:00:02.000', '00:00:01.000', '00:00:00.500'],
          filename: outputFilename,
          folder: outputDir,
          size: '1920x1080', // Tamanho máximo, será redimensionado se necessário
        })
        .on('start', (commandLine) => {
          console.log('🖼️ FFmpeg thumbnail command:', commandLine)
        })
        .on('end', async () => {
          try {
            console.log('✅ Thumbnail extracted, processing with Sharp...')
            
            // FFmpeg gera múltiplos arquivos quando há múltiplos timestamps
            // Tentar ler o primeiro disponível (geralmente o de 2 segundos)
            let thumbnailBuffer: Buffer | null = null
            const possiblePaths = [
              outputPath,
              join(outputDir, outputFilename.replace('.png', '0001.png')),
              join(outputDir, outputFilename.replace('.png', '0002.png')),
              join(outputDir, outputFilename.replace('.png', '0003.png')),
            ]
            
            for (const path of possiblePaths) {
              try {
                thumbnailBuffer = await readFile(path)
                console.log('✅ Thumbnail found at:', path)
                // Limpar outros arquivos gerados
                for (const otherPath of possiblePaths) {
                  if (otherPath !== path) {
                    await unlink(otherPath).catch(() => {})
                  }
                }
                break
              } catch (e) {
                // Tentar próximo caminho
                continue
              }
            }
            
            if (!thumbnailBuffer) {
              throw new Error('Could not find generated thumbnail file')
            }
            
            // Processar com Sharp para otimizar - tamanho menor para carregamento mais rápido
            thumbnailBuffer = await sharp(thumbnailBuffer)
              .resize(800, 800, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ 
                quality: 80, // Qualidade reduzida para arquivos menores
                progressive: true,
                mozjpeg: true,
                optimizeScans: true
              })
              .toBuffer()
            
            console.log('✅ Thumbnail processed, size:', thumbnailBuffer.length)
            
            // Limpar arquivos temporários
            await unlink(tempInputPath).catch(() => {})
            // outputPath já foi limpo no loop acima
            
            resolve(thumbnailBuffer)
          } catch (error: any) {
            console.error('❌ Error processing thumbnail:', error.message)
            // Limpar arquivos temporários
            try {
              await unlink(tempInputPath).catch(() => {})
              // Tentar limpar possíveis arquivos gerados
              const possiblePaths = [
                outputPath,
                join(tmpdir(), outputFilename.replace('.png', '0001.png')),
                join(tmpdir(), outputFilename.replace('.png', '0002.png')),
                join(tmpdir(), outputFilename.replace('.png', '0003.png')),
              ]
              for (const path of possiblePaths) {
                await unlink(path).catch(() => {})
              }
            } catch {}
            resolve(null)
          }
        })
        .on('error', async (err) => {
          console.error('❌ FFmpeg thumbnail error:', err.message)
          // Limpar arquivos temporários
          try {
            await unlink(tempInputPath).catch(() => {})
            // Tentar limpar possíveis arquivos gerados
            const possiblePaths = [
              outputPath,
              join(tmpdir(), outputFilename.replace('.png', '0001.png')),
              join(tmpdir(), outputFilename.replace('.png', '0002.png')),
              join(tmpdir(), outputFilename.replace('.png', '0003.png')),
            ]
            for (const path of possiblePaths) {
              await unlink(path).catch(() => {})
            }
          } catch {}
          resolve(null)
        })
        .run()
    })
  } catch (error: any) {
    console.error('❌ Error in extractVideoThumbnail:', error.message)
    // Limpar arquivos temporários em caso de erro
    try {
      await unlink(tempInputPath).catch(() => {})
      await unlink(tempOutputPath).catch(() => {})
    } catch {}
    return null
  }
}


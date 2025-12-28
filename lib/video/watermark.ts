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
 * Adiciona marca d'água de texto no vídeo
 * Retorna o buffer do vídeo com marca d'água ou null se falhar
 */
export async function addWatermarkToVideo(
  inputBuffer: Buffer,
  inputFormat: string,
  watermarkText: string = 'BRASILPSD'
): Promise<Buffer | null> {
  const tempInputPath = join(tmpdir(), `watermark-input-${Date.now()}-${Math.random().toString(36)}.${inputFormat}`)
  const tempOutputPath = join(tmpdir(), `watermark-output-${Date.now()}-${Math.random().toString(36)}.mp4`)
  let watermarkImagePath: string | null = null

  try {
    console.log('💧 Adding watermark to video...', { 
      format: inputFormat,
      inputSize: inputBuffer.length,
      text: watermarkText
    })
    
    // Criar imagem de marca d'água menor e mais sutil (SVG com texto rotacionado)
    const watermarkTile = Buffer.from(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <text 
          x="50%" 
          y="50%" 
          font-family="Arial, sans-serif" 
          font-weight="700" 
          font-size="48" 
          fill="rgba(255,255,255,0.2)" 
          stroke="rgba(0,0,0,0.08)" 
          stroke-width="0.8" 
          text-anchor="middle" 
          dominant-baseline="middle"
          transform="rotate(-30 200 150)"
        >
          ${watermarkText}
        </text>
      </svg>
    `)
    
    // Converter SVG para PNG para usar como overlay no vídeo (tamanho menor)
    watermarkImagePath = join(tmpdir(), `watermark-${Date.now()}-${Math.random().toString(36)}.png`)
    await sharp(watermarkTile)
      .resize(400, 300, { fit: 'inside' })
      .png()
      .toFile(watermarkImagePath)
    
    console.log('✅ Watermark image created')
    
    // Salvar buffer em arquivo temporário
    await writeFile(tempInputPath, inputBuffer)
    console.log('✅ Temporary input file created')

    if (!watermarkImagePath) {
      throw new Error('Failed to create watermark image')
    }

    const finalWatermarkPath = watermarkImagePath // TypeScript guard

    return new Promise((resolve) => {
      ffmpeg(tempInputPath)
        .input(finalWatermarkPath) // Adicionar imagem de marca d'água como segundo input
        .complexFilter([
          // Aplicar overlay repetido (tile) igual às imagens
          '[0:v][1:v]overlay=repeatboth=1:shortest=1[out]'
        ])
        .outputOptions([
          '-map [out]',
          '-map 0:a?', // Mapear áudio se existir
          '-preset fast',
          '-crf 23',
          '-movflags +faststart',
          '-y', // Sobrescrever arquivo de saída se existir
        ])
        .format('mp4')
        .videoCodec('libx264')
        .audioCodec('copy') // Manter áudio original
        .output(tempOutputPath)
        .on('start', (commandLine) => {
          console.log('💧 FFmpeg watermark command:', commandLine)
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('⏳ Watermark progress:', Math.round(progress.percent) + '%')
          }
        })
        .on('error', async (err) => {
          console.error('❌ FFmpeg watermark error:', err.message)
          // Limpar arquivos temporários
          try {
            await unlink(tempInputPath).catch(() => {})
            await unlink(tempOutputPath).catch(() => {})
            if (finalWatermarkPath) {
              await unlink(finalWatermarkPath).catch(() => {})
            }
          } catch {}
          resolve(null)
        })
        .on('end', async () => {
          try {
            console.log('✅ Video watermark completed, reading output file...')
            const outputBuffer = await readFile(tempOutputPath)
            console.log('✅ Output file read, size:', outputBuffer.length)
            
            // Limpar arquivos temporários
            await unlink(tempInputPath).catch(() => {})
            await unlink(tempOutputPath).catch(() => {})
            if (finalWatermarkPath) {
              await unlink(finalWatermarkPath).catch(() => {})
            }
            
            resolve(outputBuffer)
          } catch (error: any) {
            console.error('❌ Error reading output file:', error.message)
            // Limpar arquivos temporários
            try {
              await unlink(tempInputPath).catch(() => {})
              await unlink(tempOutputPath).catch(() => {})
              if (finalWatermarkPath) {
                await unlink(finalWatermarkPath).catch(() => {})
              }
            } catch {}
            resolve(null)
          }
        })
        .run()
    })
  } catch (error: any) {
    console.error('❌ Error in addWatermarkToVideo:', error.message)
    // Limpar arquivos temporários em caso de erro
    try {
      await unlink(tempInputPath).catch(() => {})
      await unlink(tempOutputPath).catch(() => {})
      if (watermarkImagePath) {
        await unlink(watermarkImagePath).catch(() => {})
      }
    } catch {}
    return null
  }
}

import ffmpeg from 'fluent-ffmpeg'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

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
 * Gera um preview de vídeo (metade do vídeo) para thumbnail
 * Retorna o buffer do vídeo preview (MP4) ou null se falhar
 */
export async function generateVideoPreview(
  videoBuffer: Buffer,
  videoFormat: string,
  duration?: number
): Promise<Buffer | null> {
  const tempInputPath = join(tmpdir(), `preview-input-${Date.now()}-${Math.random().toString(36)}.${videoFormat}`)
  const tempOutputPath = join(tmpdir(), `preview-output-${Date.now()}-${Math.random().toString(36)}.mp4`)

  try {
    console.log('🎬 Generating video preview (half of video)...', { 
      format: videoFormat,
      inputSize: videoBuffer.length,
      duration
    })
    
    // Salvar buffer em arquivo temporário
    await writeFile(tempInputPath, videoBuffer)
    console.log('✅ Temporary input file created')

    return new Promise((resolve) => {
      // Primeiro, obter a duração do vídeo se não foi fornecida
      ffmpeg.ffprobe(tempInputPath, async (err, metadata) => {
        if (err) {
          console.error('❌ Error getting video duration:', err.message)
          await unlink(tempInputPath).catch(() => {})
          resolve(null)
          return
        }

        const videoDuration = duration || (metadata.format?.duration ? parseFloat(metadata.format.duration) : 0)
        const previewDuration = videoDuration / 2 // Metade do vídeo
        
        if (previewDuration <= 0 || previewDuration > 30) {
          // Se não conseguir obter duração ou for muito longo, usar 10 segundos como fallback
          const fallbackDuration = 10
          console.warn(`⚠️ Invalid video duration (${videoDuration}s), using ${fallbackDuration} seconds as fallback`)
          generatePreviewWithDuration(tempInputPath, tempOutputPath, fallbackDuration, resolve)
          return
        }

        console.log(`📹 Video duration: ${videoDuration}s, preview duration: ${previewDuration}s`)
        generatePreviewWithDuration(tempInputPath, tempOutputPath, previewDuration, resolve)
      })
    })
  } catch (error: any) {
    console.error('❌ Error in generateVideoPreview:', error.message)
    // Limpar arquivos temporários em caso de erro
    try {
      await unlink(tempInputPath).catch(() => {})
      await unlink(tempOutputPath).catch(() => {})
    } catch {}
    return null
  }
}

/**
 * Gera preview com duração específica
 */
async function generatePreviewWithDuration(
  inputPath: string,
  outputPath: string,
  duration: number,
  resolve: (value: Buffer | null) => void
): Promise<void> {
  ffmpeg(inputPath)
    .setDuration(duration) // Limitar a metade do vídeo
    .outputOptions([
      '-preset fast',
      '-crf 28', // Qualidade um pouco menor para arquivo menor
      '-movflags +faststart', // Otimização para web
      '-vf scale=1280:-2', // Redimensionar para largura máxima de 1280px mantendo aspect ratio
      '-an', // Remover áudio para reduzir tamanho
      '-y', // Sobrescrever arquivo de saída se existir
    ])
    .format('mp4')
    .videoCodec('libx264')
    .output(outputPath)
    .on('start', (commandLine) => {
      console.log('🎬 FFmpeg preview command:', commandLine)
    })
    .on('progress', (progress) => {
      if (progress.percent) {
        console.log('⏳ Preview generation progress:', Math.round(progress.percent) + '%')
      }
    })
    .on('error', async (err) => {
      console.error('❌ FFmpeg preview error:', err.message)
      // Limpar arquivos temporários
      try {
        await unlink(inputPath).catch(() => {})
        await unlink(outputPath).catch(() => {})
      } catch {}
      resolve(null)
    })
    .on('end', async () => {
      try {
        console.log('✅ Video preview completed, reading output file...')
        const outputBuffer = await readFile(outputPath)
        console.log('✅ Preview file read, size:', outputBuffer.length)
        
        // Limpar arquivos temporários
        await unlink(inputPath).catch(() => {})
        await unlink(outputPath).catch(() => {})
        
        resolve(outputBuffer)
      } catch (error: any) {
        console.error('❌ Error reading preview file:', error.message)
        // Limpar arquivos temporários
        try {
          await unlink(inputPath).catch(() => {})
          await unlink(outputPath).catch(() => {})
        } catch {}
        resolve(null)
      }
    })
    .run()
}


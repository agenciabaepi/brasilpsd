import ffmpeg from 'fluent-ffmpeg'
import { Readable } from 'stream'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

// Detectar caminho do FFmpeg e FFprobe
let ffmpegPath: string | null = null
let ffprobePath: string | null = null

try {
  const path = execSync('which ffmpeg', { encoding: 'utf-8' }).trim()
  if (path) {
    ffmpegPath = path
    console.log('✅ FFmpeg found at:', ffmpegPath)
  }
} catch (error) {
  console.warn('⚠️ Could not detect FFmpeg path')
}

try {
  const path = execSync('which ffprobe', { encoding: 'utf-8' }).trim()
  if (path) {
    ffprobePath = path
    console.log('✅ FFprobe found at:', ffprobePath)
  }
} catch (error) {
  console.warn('⚠️ Could not detect FFprobe path')
}

// Configurar caminhos se encontrados
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath)
}

/**
 * Converte vídeo MOV (ou outros formatos) para MP4
 * Retorna o buffer do vídeo convertido ou null se a conversão falhar
 */
export async function convertVideoToMp4(
  inputBuffer: Buffer,
  inputFormat: string
): Promise<Buffer | null> {
  // Só converter se for MOV ou outro formato que precisa de conversão
  const needsConversion = ['mov', 'avi', 'mkv', 'webm'].includes(inputFormat.toLowerCase())
  
  if (!needsConversion) {
    console.log('ℹ️ Video format does not need conversion:', inputFormat)
    return null
  }

  const tempInputPath = join(tmpdir(), `input-${Date.now()}-${Math.random().toString(36)}.${inputFormat}`)
  const tempOutputPath = join(tmpdir(), `output-${Date.now()}-${Math.random().toString(36)}.mp4`)

  try {
    console.log('🔄 Converting video to MP4...', { 
      format: inputFormat,
      inputSize: inputBuffer.length,
      tempInput: tempInputPath
    })
    
    // Salvar buffer em arquivo temporário
    await writeFile(tempInputPath, inputBuffer)
    console.log('✅ Temporary input file created')

    return new Promise((resolve) => {
      const chunks: Buffer[] = []
      
      ffmpeg(tempInputPath)
        .format('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23', // Qualidade balanceada
          '-movflags +faststart', // Otimização para web
          '-y', // Sobrescrever arquivo de saída se existir
        ])
        .output(tempOutputPath)
        .on('start', (commandLine) => {
          console.log('📹 FFmpeg command:', commandLine)
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('⏳ Conversion progress:', Math.round(progress.percent) + '%')
          }
        })
        .on('error', async (err) => {
          console.error('❌ FFmpeg conversion error:', err.message)
          // Limpar arquivos temporários
          try {
            await unlink(tempInputPath).catch(() => {})
            await unlink(tempOutputPath).catch(() => {})
          } catch {}
          resolve(null)
        })
        .on('end', async () => {
          try {
            console.log('✅ Video conversion completed, reading output file...')
            const outputBuffer = await readFile(tempOutputPath)
            console.log('✅ Output file read, size:', outputBuffer.length)
            
            // Limpar arquivos temporários
            await unlink(tempInputPath).catch(() => {})
            await unlink(tempOutputPath).catch(() => {})
            
            resolve(outputBuffer)
          } catch (error: any) {
            console.error('❌ Error reading output file:', error.message)
            // Limpar arquivos temporários
            try {
              await unlink(tempInputPath).catch(() => {})
              await unlink(tempOutputPath).catch(() => {})
            } catch {}
            resolve(null)
          }
        })
        .run()
    })
  } catch (error: any) {
    console.error('❌ Error in convertVideoToMp4:', error.message)
    // Limpar arquivos temporários em caso de erro
    try {
      await unlink(tempInputPath).catch(() => {})
      await unlink(tempOutputPath).catch(() => {})
    } catch {}
    return null
  }
}

/**
 * Extrai metadados do vídeo usando FFprobe
 */
export async function extractVideoMetadata(filePath: string): Promise<{
  width: number
  height: number
  duration: number
  frameRate?: number
  bitrate?: number
  codec?: string
  codecName?: string
  codecLongName?: string
  colorSpace?: string
  colorRange?: string
  colorPrimaries?: string
  colorTransfer?: string
  pixelFormat?: string
  hasTimecode?: boolean
  audioCodec?: string
} | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('❌ Error extracting video metadata:', err.message)
        resolve(null)
        return
      }

      const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video')
      const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio')
      
      if (!videoStream) {
        console.warn('⚠️ No video stream found in metadata')
        resolve(null)
        return
      }

      const duration = metadata.format?.duration ? parseFloat(metadata.format.duration) : 0
      const frameRate = videoStream.r_frame_rate 
        ? parseFloat(videoStream.r_frame_rate.split('/')[0]) / parseFloat(videoStream.r_frame_rate.split('/')[1] || '1')
        : undefined

      // Detectar codec
      const codecName = videoStream.codec_name || videoStream.codec
      const codecLongName = videoStream.codec_long_name
      
      // Formatar codec (ex: "Apple ProRes 422" de "prores")
      let formattedCodec = codecName
      if (codecName === 'prores') {
        const profile = videoStream.profile || ''
        if (profile.includes('422')) {
          formattedCodec = 'Apple ProRes 422'
        } else if (profile.includes('4444')) {
          formattedCodec = 'Apple ProRes 4444'
        } else if (profile.includes('HQ')) {
          formattedCodec = 'Apple ProRes HQ'
        } else {
          formattedCodec = `Apple ProRes ${profile || codecName.toUpperCase()}`
        }
      } else if (codecName === 'h264') {
        formattedCodec = 'H.264'
      } else if (codecName === 'hevc' || codecName === 'h265') {
        formattedCodec = 'H.265'
      } else if (codecName) {
        formattedCodec = codecName.toUpperCase()
      }

      // Detectar timecode
      const hasTimecode = videoStream.tags?.timecode !== undefined || 
                         videoStream.tags?.['com.apple.proapps.timecode.raw'] !== undefined ||
                         metadata.format?.tags?.timecode !== undefined

      // Informações de cor
      const colorSpace = videoStream.color_space || videoStream.color_space_original
      const colorRange = videoStream.color_range
      const colorPrimaries = videoStream.color_primaries
      const colorTransfer = videoStream.color_trc || videoStream.color_transfer
      const pixelFormat = videoStream.pix_fmt

      // Audio codec
      const audioCodec = audioStream?.codec_name || audioStream?.codec

      console.log('✅ Video metadata extracted:', {
        width: videoStream.width,
        height: videoStream.height,
        duration,
        frameRate,
        codec: formattedCodec,
        colorSpace,
        hasTimecode
      })

      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: Math.round(duration),
        frameRate: frameRate ? Math.round(frameRate * 100) / 100 : undefined,
        bitrate: metadata.format?.bit_rate ? parseInt(metadata.format.bit_rate) : undefined,
        codec: formattedCodec,
        codecName: codecName,
        codecLongName: codecLongName,
        colorSpace: colorSpace,
        colorRange: colorRange,
        colorPrimaries: colorPrimaries,
        colorTransfer: colorTransfer,
        pixelFormat: pixelFormat,
        hasTimecode: hasTimecode,
        audioCodec: audioCodec
      })
    })
  })
}

/**
 * Verifica se ffmpeg está disponível no sistema
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableCodecs((err, codecs) => {
      if (err) {
        console.warn('⚠️ FFmpeg not available:', err.message)
        resolve(false)
      } else {
        console.log('✅ FFmpeg is available')
        resolve(true)
      }
    })
  })
}


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
 * Adiciona marca d'água de áudio sobrepondo o áudio original
 * Retorna o buffer do áudio com marca d'água ou null se falhar
 */
export async function addWatermarkToAudio(
  inputBuffer: Buffer,
  inputFormat: string,
  watermarkAudioPath: string = '/marca dagua audio.mp3'
): Promise<Buffer | null> {
  const tempInputPath = join(tmpdir(), `audio-input-${Date.now()}-${Math.random().toString(36)}.${inputFormat}`)
  const tempOutputPath = join(tmpdir(), `audio-output-${Date.now()}-${Math.random().toString(36)}.${inputFormat}`)

  try {
    console.log('💧 Adding audio watermark...', { 
      format: inputFormat,
      inputSize: inputBuffer.length,
      watermarkPath: watermarkAudioPath
    })
    
    // Salvar buffer em arquivo temporário
    await writeFile(tempInputPath, inputBuffer)
    console.log('✅ Temporary input file created')

    // Resolver caminho do arquivo de marca d'água
    // Se for caminho relativo, assumir que está em public/
    let finalWatermarkPath = watermarkAudioPath
    if (!watermarkAudioPath.startsWith('/') && !watermarkAudioPath.includes('://')) {
      // Tentar encontrar o arquivo na pasta public
      const { join: pathJoin } = await import('path')
      const publicPath = pathJoin(process.cwd(), 'public', watermarkAudioPath)
      finalWatermarkPath = publicPath
    }

    return new Promise((resolve) => {
      ffmpeg(tempInputPath)
        .input(finalWatermarkPath) // Adicionar áudio de marca d'água como segundo input
        .inputOptions([
          '-stream_loop', '-1' // Fazer loop infinito da marca d'água
        ])
        .complexFilter([
          // Aumentar volume da marca d'água para 0.5 (50%) e misturar com o áudio original
          // O stream_loop fará a marca d'água repetir durante toda a duração do áudio principal
          '[1:a]volume=0.5[watermark];[0:a][watermark]amix=inputs=2:duration=longest:dropout_transition=2[out]'
        ])
        .outputOptions([
          '-map [out]',
          '-acodec libmp3lame', // Usar MP3 para compatibilidade
          '-b:a 128k', // Bitrate de 128kbps para manter qualidade mas reduzir tamanho
          '-y', // Sobrescrever arquivo de saída se existir
        ])
        .format(inputFormat === 'mp3' ? 'mp3' : 'mp3') // Sempre converter para MP3 para compatibilidade
        .output(tempOutputPath)
        .on('start', (commandLine) => {
          console.log('💧 FFmpeg audio watermark command:', commandLine)
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('⏳ Audio watermark progress:', Math.round(progress.percent) + '%')
          }
        })
        .on('error', async (err) => {
          console.error('❌ FFmpeg audio watermark error:', err.message)
          // Limpar arquivos temporários
          try {
            await unlink(tempInputPath).catch(() => {})
            await unlink(tempOutputPath).catch(() => {})
          } catch {}
          resolve(null)
        })
        .on('end', async () => {
          try {
            console.log('✅ Audio watermark completed, reading output file...')
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
    console.error('❌ Error in addWatermarkToAudio:', error.message)
    // Limpar arquivos temporários em caso de erro
    try {
      await unlink(tempInputPath).catch(() => {})
      await unlink(tempOutputPath).catch(() => {})
    } catch {}
    return null
  }
}

/**
 * Extrai metadados de áudio (duração, bitrate, etc)
 */
export async function extractAudioMetadata(
  inputBuffer: Buffer,
  inputFormat: string
): Promise<{ duration?: number; bitrate?: number; sampleRate?: number; channels?: number } | null> {
  const tempInputPath = join(tmpdir(), `audio-metadata-${Date.now()}-${Math.random().toString(36)}.${inputFormat}`)

  try {
    await writeFile(tempInputPath, inputBuffer)

    return new Promise((resolve) => {
      ffmpeg.ffprobe(tempInputPath, (err, metadata) => {
        // Limpar arquivo temporário
        unlink(tempInputPath).catch(() => {})

        if (err) {
          console.warn('⚠️ Could not extract audio metadata:', err.message)
          resolve(null)
          return
        }

        const audioStream = metadata.streams?.find(s => s.codec_type === 'audio')
        const duration = metadata.format?.duration ? Math.round(metadata.format.duration) : undefined
        const bitrate = metadata.format?.bit_rate ? parseInt(metadata.format.bit_rate) : undefined
        const sampleRate = audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : undefined
        const channels = audioStream?.channels

        resolve({
          duration,
          bitrate,
          sampleRate,
          channels
        })
      })
    })
  } catch (error: any) {
    console.error('❌ Error extracting audio metadata:', error.message)
    try {
      await unlink(tempInputPath).catch(() => {})
    } catch {}
    return null
  }
}


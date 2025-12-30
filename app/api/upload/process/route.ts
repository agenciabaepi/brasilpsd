import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { convertVideoToMp4, checkFfmpegAvailable, extractVideoMetadata } from '@/lib/video/convert'
import { addWatermarkToVideo } from '@/lib/video/watermark'
import { extractVideoThumbnail } from '@/lib/video/thumbnail'
import { generateVideoPreview } from '@/lib/video/preview'
import { uploadFileToS3, getSignedDownloadUrl } from '@/lib/aws/s3'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export const maxDuration = 300 // 5 minutos para processamento
export const runtime = 'nodejs'

/**
 * Processa arquivo já enviado para S3
 * Faz conversão, watermark e thumbnail para vídeos
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🔄 Processing uploaded file...')
  
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { key, url, fileName, contentType, fileSize, type } = await request.json()

    if (!key || !url) {
      return NextResponse.json({ error: 'key e url são obrigatórios' }, { status: 400 })
    }

    // Baixar arquivo do S3 para processar
    // Usar URL assinada para garantir acesso mesmo se o bucket for privado
    console.log('⬇️ Downloading file from S3 for processing...', { key })
    const signedUrl = await getSignedDownloadUrl(key, 3600) // 1 hora de validade
    const fileResponse = await fetch(signedUrl)
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from S3: ${fileResponse.statusText}`)
    }

    const arrayBuffer = await fileResponse.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
    let finalUrl = url // URL final do arquivo (pode ser convertido)
    let finalKey = key // Key final do arquivo (pode ser convertido)
    let previewUrl: string | null = null
    let thumbnailUrl: string | null = null
    let videoMetadata: any = null

    // Processar apenas se for vídeo e tipo resource
    if (type === 'resource' && contentType.startsWith('video/')) {
      const ffmpegAvailable = await checkFfmpegAvailable()
      
      if (ffmpegAvailable) {
        // 1. Converter para MP4 se necessário
        let convertedBuffer = buffer
        let wasConverted = false
        
        if (fileExtension !== 'mp4') {
          console.log('🎬 Converting video to MP4...', { originalExtension: fileExtension })
          convertedBuffer = await convertVideoToMp4(buffer, fileExtension)
          if (convertedBuffer && convertedBuffer.length > 0) {
            buffer = convertedBuffer
            wasConverted = true
            console.log('✅ Video converted to MP4', {
              originalSize: arrayBuffer.byteLength,
              convertedSize: convertedBuffer.length
            })
          }
        }

        // 2. Extrair metadados do vídeo convertido
        const tempPath = join(tmpdir(), `process-${Date.now()}-${Math.random().toString(36)}.mp4`)
        try {
          await writeFile(tempPath, buffer)
          videoMetadata = await extractVideoMetadata(tempPath)
          await unlink(tempPath).catch(() => {})
          console.log('✅ Video metadata extracted:', videoMetadata)
        } catch (error: any) {
          console.warn('⚠️ Could not extract metadata:', error.message)
          await unlink(tempPath).catch(() => {})
        }

        // 3. Reenviar arquivo convertido para resources/ (substituindo o original)
        if (wasConverted || fileExtension === 'mp4') {
          const mp4FileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
          const mp4Key = `resources/${user.id}/${mp4FileName}`
          finalUrl = await uploadFileToS3({
            file: buffer,
            key: mp4Key,
            contentType: 'video/mp4',
            metadata: {
              userId: user.id,
              originalName: fileName,
              isConverted: wasConverted ? 'true' : 'false',
              originalExtension: fileExtension
            },
          })
          finalKey = mp4Key
          console.log('✅ Converted video uploaded to resources/', { key: mp4Key, url: finalUrl })
        }

        // 4. Criar preview leve (metade do vídeo) para video-previews/
        const previewResult = await generateVideoPreview(buffer, 'mp4', videoMetadata?.duration)
        if (previewResult && previewResult.length > 0) {
          // Adicionar marca d'água ao preview
          const watermarkedPreview = await addWatermarkToVideo(previewResult, 'mp4', 'BRASILPSD')
          const finalPreview = watermarkedPreview || previewResult
          
          const previewFileName = `video-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
          const previewKey = `video-previews/${user.id}/${previewFileName}`
          previewUrl = await uploadFileToS3({
            file: finalPreview,
            key: previewKey,
            contentType: 'video/mp4',
            metadata: {
              userId: user.id,
              originalName: fileName,
              isVideoPreview: 'true'
            },
          })
          console.log('✅ Video preview uploaded to video-previews/', { key: previewKey, url: previewUrl })
        }

        // 5. Extrair thumbnail (fallback)
        const thumbnailResult = await extractVideoThumbnail(buffer, 'mp4', 'jpeg', 85)
        if (thumbnailResult && thumbnailResult.length > 0) {
          const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
          const thumbnailKey = `thumbnails/${user.id}/${thumbnailFileName}`
          thumbnailUrl = await uploadFileToS3({
            file: thumbnailResult,
            key: thumbnailKey,
            contentType: 'image/jpeg',
            metadata: {
              userId: user.id,
              originalName: fileName,
              isThumbnail: 'true'
            },
          })
          console.log('✅ Thumbnail uploaded', { key: thumbnailKey, url: thumbnailUrl })
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('✅ Processing completed!', { totalTime: `${totalTime}s` })

    return NextResponse.json({
      url: finalUrl, // URL do arquivo convertido (MP4) em resources/
      key: finalKey, // Key do arquivo convertido
      previewUrl: previewUrl || undefined, // Preview leve em video-previews/
      thumbnailUrl: thumbnailUrl || undefined,
      videoMetadata: videoMetadata || undefined,
      wasConverted: wasConverted || false, // Indica se foi convertido
      finalFormat: 'mp4' // Formato final sempre MP4 após conversão
    })
  } catch (error: any) {
    console.error('❌ Processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar arquivo' },
      { status: 500 }
    )
  }
}


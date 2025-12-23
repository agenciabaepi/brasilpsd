import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { convertVideoToMp4, checkFfmpegAvailable, extractVideoMetadata } from '@/lib/video/convert'
import { addWatermarkToVideo } from '@/lib/video/watermark'
import { extractVideoThumbnail } from '@/lib/video/thumbnail'
import { uploadFileToS3 } from '@/lib/aws/s3'
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
    console.log('⬇️ Downloading file from S3 for processing...', { key, url })
    const fileResponse = await fetch(url)
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from S3: ${fileResponse.statusText}`)
    }

    const arrayBuffer = await fileResponse.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
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
          console.log('🎬 Converting video to MP4...')
          convertedBuffer = await convertVideoToMp4(buffer, fileExtension)
          if (convertedBuffer && convertedBuffer.length > 0) {
            buffer = convertedBuffer
            wasConverted = true
            console.log('✅ Video converted to MP4')
          }
        }

        // 2. Extrair metadados
        const tempPath = join(tmpdir(), `process-${Date.now()}-${Math.random().toString(36)}.mp4`)
        try {
          await writeFile(tempPath, buffer)
          videoMetadata = await extractVideoMetadata(tempPath)
          await unlink(tempPath).catch(() => {})
        } catch (error: any) {
          console.warn('⚠️ Could not extract metadata:', error.message)
          await unlink(tempPath).catch(() => {})
        }

        // 3. Criar preview com watermark e thumbnail (em paralelo)
        const [watermarkResult, thumbnailResult] = await Promise.allSettled([
          addWatermarkToVideo(buffer, 'mp4', 'BRASILPSD'),
          extractVideoThumbnail(buffer, 'mp4', 'jpeg', 85)
        ])

        if (watermarkResult.status === 'fulfilled' && watermarkResult.value) {
          const previewFileName = `preview-${user.id}-${Date.now()}.mp4`
          const previewKey = `previews/${user.id}/${previewFileName}`
          previewUrl = await uploadFileToS3({
            file: watermarkResult.value,
            key: previewKey,
            contentType: 'video/mp4',
            metadata: { userId: user.id, originalName: fileName, isPreview: 'true' },
          })
          console.log('✅ Preview with watermark uploaded')
        }

        if (thumbnailResult.status === 'fulfilled' && thumbnailResult.value) {
          const thumbnailFileName = `thumb-${user.id}-${Date.now()}.jpg`
          const thumbnailKey = `thumbnails/${user.id}/${thumbnailFileName}`
          thumbnailUrl = await uploadFileToS3({
            file: thumbnailResult.value,
            key: thumbnailKey,
            contentType: 'image/jpeg',
            metadata: { userId: user.id, originalName: fileName, isThumbnail: 'true' },
          })
          console.log('✅ Thumbnail uploaded')
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('✅ Processing completed!', { totalTime: `${totalTime}s` })

    return NextResponse.json({
      url,
      key,
      previewUrl: previewUrl || undefined,
      thumbnailUrl: thumbnailUrl || undefined,
      videoMetadata: videoMetadata || undefined
    })
  } catch (error: any) {
    console.error('❌ Processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar arquivo' },
      { status: 500 }
    )
  }
}


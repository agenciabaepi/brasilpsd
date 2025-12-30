import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { convertVideoToMp4, checkFfmpegAvailable, extractVideoMetadata } from '@/lib/video/convert'
import { addWatermarkToVideo } from '@/lib/video/watermark'
import { extractVideoThumbnail } from '@/lib/video/thumbnail'
import { generateVideoPreview } from '@/lib/video/preview'
import { uploadFileToS3, getSignedDownloadUrl } from '@/lib/aws/s3'
import { enqueueVideoProcessing } from '@/lib/aws/sqs'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export const maxDuration = 300 // 5 minutos para processamento
export const runtime = 'nodejs'

/**
 * Processa arquivo já enviado para S3
 * 
 * NOVO FLUXO (assíncrono):
 * - Se SQS_QUEUE_URL estiver configurado: enfileira processamento e retorna imediatamente
 * - Se não: processa síncronamente (fallback para compatibilidade)
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

    const body = await request.json()
    const { key, url, fileName, contentType, fileSize, type, resourceId } = body
    
    console.log('📥 Dados recebidos na rota /api/upload/process:', {
      hasKey: !!key,
      hasUrl: !!url,
      fileName,
      contentType,
      type,
      hasResourceId: !!resourceId,
      resourceId: resourceId?.substring(0, 30) + '...' || 'NÃO FORNECIDO'
    })

    if (!key || !url) {
      return NextResponse.json({ error: 'key e url são obrigatórios' }, { status: 400 })
    }

    // NOVO: Se SQS estiver configurado e for vídeo, enfileirar processamento assíncrono
    const hasSqs = !!process.env.SQS_QUEUE_URL
    const isVideo = type === 'resource' && contentType.startsWith('video/')
    const useAsyncProcessing = hasSqs && isVideo
    
    console.log('🔍 Verificando processamento assíncrono:', {
      hasSqs,
      isVideo,
      type,
      contentType,
      hasResourceId: !!resourceId,
      resourceId: resourceId?.substring(0, 20) + '...',
      useAsyncProcessing
    })
    
    if (useAsyncProcessing && resourceId) {
      console.log('📤 Enfileirando processamento assíncrono via SQS...', {
        resourceId,
        key,
        userId: user.id,
        fileName
      })
      try {
        await enqueueVideoProcessing({
          resourceId,
          key,
          userId: user.id,
          fileName,
          contentType
        })
        
        console.log('✅ Processamento enfileirado com sucesso na SQS')
        
        // Retornar imediatamente - worker processará em background
        return NextResponse.json({
          url, // URL original temporária
          key, // Key original
          previewUrl: undefined,
          thumbnailUrl: undefined,
          videoMetadata: undefined,
          wasConverted: false,
          finalFormat: fileName.split('.').pop()?.toLowerCase() || '',
          processing: 'queued' // Indica que foi enfileirado
        })
      } catch (error: any) {
        console.error('❌ Erro ao enfileirar, caindo back para processamento síncrono:', error.message)
        console.error('❌ Erro completo:', error)
        // Continuar com processamento síncrono como fallback
      }
    } else {
      console.log('⚠️ Condições para processamento assíncrono não atendidas:', {
        useAsyncProcessing,
        hasResourceId: !!resourceId,
        motivo: !hasSqs ? 'SQS_QUEUE_URL não configurado' : !isVideo ? 'Não é vídeo' : !resourceId ? 'resourceId não fornecido' : 'Desconhecido'
      })
    }
    
    // Processamento síncrono (fallback ou quando SQS não está configurado)
    console.log('🔄 Processando síncronamente...')

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


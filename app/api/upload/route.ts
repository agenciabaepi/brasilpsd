import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3 } from '@/lib/aws/s3'
import sharp from 'sharp'
import { convertVideoToMp4, checkFfmpegAvailable, extractVideoMetadata } from '@/lib/video/convert'
import { addWatermarkToVideo } from '@/lib/video/watermark'
import { extractVideoThumbnail } from '@/lib/video/thumbnail'
import { generateVideoPreview } from '@/lib/video/preview'
import { addWatermarkToAudio, extractAudioMetadata } from '@/lib/audio/watermark'

export const maxDuration = 300 // 5 minutos para uploads grandes
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('📤 Upload request started')
  
  try {
    console.log('🔐 Authenticating user...')
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile || (!profile.is_creator && !profile.is_admin)) {
      console.error('❌ Access denied for user:', user.id)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    console.log('📋 Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      console.error('❌ No file provided')
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    console.log('📦 Converting file to buffer...', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    const bytes = await file.arrayBuffer()
    console.log('✅ File converted to buffer, size:', bytes.byteLength)
    
    let buffer = Buffer.from(bytes)
    let contentType = file.type
    let fileExtension = file.name.split('.').pop()?.toLowerCase()
    let isAiGenerated = false

    // Log para debug
    console.log('Upload file info:', {
      name: file.name,
      type: file.type,
      size: file.size,
      extension: fileExtension,
      uploadType: type
    })

    // Garantir Content-Type correto para vídeos
    if (type === 'resource' && file.type.startsWith('video/')) {
      // Mapear extensões comuns para Content-Type correto
      const videoContentTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
        'mkv': 'video/x-matroska',
        'm4v': 'video/mp4',
      }
      
      if (fileExtension && videoContentTypes[fileExtension]) {
        contentType = videoContentTypes[fileExtension]
        console.log('Set video Content-Type to:', contentType)
      } else if (!contentType || contentType === 'application/octet-stream') {
        contentType = 'video/mp4' // Default
        console.log('Using default video Content-Type:', contentType)
      }
    }

    // Garantir Content-Type correto para áudios
    if (type === 'resource' && file.type.startsWith('audio/')) {
      // Mapear extensões comuns para Content-Type correto
      const audioContentTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'wma': 'audio/x-ms-wma',
      }
      
      if (fileExtension && audioContentTypes[fileExtension]) {
        contentType = audioContentTypes[fileExtension]
        console.log('Set audio Content-Type to:', contentType)
      } else if (!contentType || contentType === 'application/octet-stream') {
        contentType = 'audio/mpeg' // Default para MP3
        console.log('Using default audio Content-Type:', contentType)
      }
    }

    // 0. AI Detection - apenas para recursos (não para thumbnails)
    if (type === 'resource' && file.type.startsWith('image/')) {
      try {
        // Processar apenas metadados sem carregar toda a imagem na memória
        const metadata = await sharp(buffer).metadata()
        const metadataString = JSON.stringify(metadata).toLowerCase()
        const aiMarkers = ['midjourney', 'dall-e', 'stablediffusion', 'adobe firefly', 'generative fill', 'artificial intelligence', 'ai generated']
        isAiGenerated = aiMarkers.some(marker => metadataString.includes(marker))
      } catch (err) {
        console.warn('AI Analysis failed:', err)
        // Não bloquear upload se falhar
      }
    }

    // 1. Thumbnail Processing + Watermark (otimizado)
    if (type === 'thumbnail') {
      try {
        // Criar marca d'água GRANDE e VISÍVEL para repetir (Tiling)
        const watermarkTile = Buffer.from(`
          <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
            <text 
              x="50%" 
              y="50%" 
              font-family="Arial, sans-serif" 
              font-weight="900" 
              font-size="120" 
              fill="rgba(255,255,255,0.5)" 
              stroke="rgba(0,0,0,0.3)" 
              stroke-width="2" 
              text-anchor="middle" 
              dominant-baseline="middle"
              transform="rotate(-30 400 300)"
            >
              BRASILPSD
            </text>
          </svg>
        `)

        // Otimizar: verificar dimensões antes de processar
        const image = sharp(buffer)
        const metadata = await image.metadata()
        
        // Se a imagem já for pequena (menos de 1200px), não redimensionar
        const needsResize = (metadata.width && metadata.width > 1200) || (metadata.height && metadata.height > 1200)
        
        let pipeline = image
        if (needsResize) {
          pipeline = pipeline.resize(1200, 1200, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
        }
        
        // Aplicar watermark e converter para webp com qualidade otimizada
        const processedBuffer = await pipeline
          .composite([{ 
            input: watermarkTile, 
            tile: true,
            blend: 'over' 
          }])
          .webp({ quality: 75, effort: 4 }) // Reduzir qualidade e effort para ser mais rápido
          .toBuffer()
        buffer = Buffer.from(processedBuffer)

        contentType = 'image/webp'
        fileExtension = 'webp'
      } catch (err) {
        console.warn('Thumbnail processing failed, using original:', err)
        // Se falhar, usar o arquivo original
      }
    }

    // 2. Video Conversion - Converter MOV e outros formatos para MP4
    let convertedVideoBuffer: Buffer | null = null
    let originalBuffer = buffer // Manter original para download
    let previewExtension = fileExtension
    let wasConverted = false
    let videoMetadata: { 
      width?: number
      height?: number
      duration?: number
      frameRate?: number
      codec?: string
      codecName?: string
      colorSpace?: string
      hasTimecode?: boolean
      audioCodec?: string
    } | null = null
    
    if (type === 'resource' && file.type.startsWith('video/') && fileExtension) {
      console.log('🎬 Video detected, checking conversion needs...', {
        extension: fileExtension,
        contentType: file.type,
        size: buffer.length
      })
      
      const ffmpegAvailable = await checkFfmpegAvailable()
      console.log('🔍 FFmpeg availability check:', ffmpegAvailable)
      
      if (ffmpegAvailable) {
        // Primeiro, extrair metadados do vídeo original
        const { writeFile: writeTempFile, unlink: deleteTempFile } = await import('fs/promises')
        const { join } = await import('path')
        const { tmpdir } = await import('os')
        const tempOriginalPath = join(tmpdir(), `original-${Date.now()}-${Math.random().toString(36)}.${fileExtension}`)
        
        try {
          await writeTempFile(tempOriginalPath, buffer)
          console.log('📊 Extracting metadata from original video...')
          videoMetadata = await extractVideoMetadata(tempOriginalPath)
          await deleteTempFile(tempOriginalPath).catch(() => {})
        } catch (error: any) {
          console.warn('⚠️ Could not extract metadata from original:', error.message)
          await deleteTempFile(tempOriginalPath).catch(() => {})
        }
        
        console.log('🎬 Attempting to convert video to MP4...', {
          originalExtension: fileExtension,
          originalSize: buffer.length
        })
        convertedVideoBuffer = await convertVideoToMp4(buffer, fileExtension)
        
        if (convertedVideoBuffer && convertedVideoBuffer.length > 0) {
          console.log('✅ Video converted successfully', {
            originalSize: buffer.length,
            convertedSize: convertedVideoBuffer.length,
            reduction: `${((1 - convertedVideoBuffer.length / buffer.length) * 100).toFixed(1)}%`
          })
          
          // Extrair metadados do vídeo convertido (mais confiável)
          const tempConvertedPath = join(tmpdir(), `converted-${Date.now()}-${Math.random().toString(36)}.mp4`)
          try {
            await writeTempFile(tempConvertedPath, convertedVideoBuffer)
            console.log('📊 Extracting metadata from converted video...')
            const convertedMetadata = await extractVideoMetadata(tempConvertedPath)
            if (convertedMetadata) {
              videoMetadata = convertedMetadata
              console.log('✅ Metadata extracted from converted video:', videoMetadata)
            }
            await deleteTempFile(tempConvertedPath).catch(() => {})
          } catch (error: any) {
            console.warn('⚠️ Could not extract metadata from converted video:', error.message)
            await deleteTempFile(tempConvertedPath).catch(() => {})
          }
          
          // Usar o MP4 convertido como base
          buffer = convertedVideoBuffer
          previewExtension = 'mp4'
          contentType = 'video/mp4'
          wasConverted = true
          console.log('✅ Using converted MP4 file')
        } else {
          console.warn('⚠️ Video conversion failed or returned empty, using original MOV')
          console.warn('⚠️ Note: MOV files may not play in all browsers')
        }
      } else {
        console.warn('⚠️ FFmpeg not available, skipping video conversion')
        console.warn('⚠️ To enable conversion, install FFmpeg: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)')
      }
    } else {
      console.log('ℹ️ Not a video or no extension, skipping conversion')
    }

    // 3. Processamento de imagem/vídeo (marca d'água e thumbnail) - fazer em paralelo e de forma otimizada
    let previewBuffer: Buffer | null = null
    let previewUrl: string | null = null
    let thumbnailBuffer: Buffer | null = null
    let thumbnailUrl: string | null = null
    
    // 3.1. Processar imagens: criar preview com marca d'água e thumbnail
    if (type === 'resource' && file.type.startsWith('image/') && buffer) {
      try {
        console.log('🖼️ Processing image: watermark + thumbnail...')
        const image = sharp(buffer)
        const metadata = await image.metadata()
        
        // Criar marca d'água GRANDE e VISÍVEL para repetir (Tiling)
        const watermarkTile = Buffer.from(`
          <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
            <text 
              x="50%" 
              y="50%" 
              font-family="Arial, sans-serif" 
              font-weight="900" 
              font-size="120" 
              fill="rgba(255,255,255,0.5)" 
              stroke="rgba(0,0,0,0.3)" 
              stroke-width="2" 
              text-anchor="middle" 
              dominant-baseline="middle"
              transform="rotate(-30 400 300)"
            >
              BRASILPSD
            </text>
          </svg>
        `)
        
        // Processar preview com marca d'água e thumbnail em paralelo
        const [previewResult, thumbnailResult] = await Promise.allSettled([
          // 3.1.1. Criar versão com marca d'água para preview
          (async () => {
            console.log('💧 Creating watermarked preview for image...')
            const watermarked = await image
              .clone()
              .composite([{ 
                input: watermarkTile, 
                tile: true,
                blend: 'over' 
              }])
              .toBuffer()
            
            if (watermarked && watermarked.length > 0) {
              const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension || 'jpg'}`
              const previewKey = `previews/${user.id}/${previewFileName}`
              const url = await uploadFileToS3({
                file: watermarked,
                key: previewKey,
                contentType: contentType,
                metadata: {
                  userId: user.id,
                  originalName: file.name,
                  isPreview: 'true'
                },
              })
              console.log('✅ Preview with watermark uploaded:', url)
              return { buffer: watermarked, url }
            }
            return null
          })(),
          // 3.1.2. Gerar thumbnail otimizado
          (async () => {
            console.log('🖼️ Generating thumbnail for image...')
            // Sempre criar um thumbnail otimizado, mesmo para imagens pequenas
            const maxThumbnailSize = 800
            let targetWidth = maxThumbnailSize
            let targetHeight = maxThumbnailSize
            
            // Se a imagem for menor que 800px, redimensionar para 70% do tamanho original
            if (metadata.width && metadata.height) {
              if (metadata.width <= maxThumbnailSize && metadata.height <= maxThumbnailSize) {
                targetWidth = Math.max(400, Math.floor(metadata.width * 0.7))
                targetHeight = Math.max(400, Math.floor(metadata.height * 0.7))
              }
            }
            
            // Criar thumbnail otimizado
            const thumb = await image
              .clone()
              .resize(targetWidth, targetHeight, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ 
                quality: 75,
                mozjpeg: true,
                progressive: true
              })
              .toBuffer()
            
            const originalSize = buffer.length
            const thumbnailSize = thumb.length
            
            if (thumb && thumb.length > 0) {
              // Só usar o thumbnail se ele for menor que o original
              if (thumbnailSize < originalSize * 0.8 || originalSize > 500 * 1024) {
                const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
                const thumbnailKey = `thumbnails/${user.id}/${thumbnailFileName}`
                const url = await uploadFileToS3({
                  file: thumb,
                  key: thumbnailKey,
                  contentType: 'image/jpeg',
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isThumbnail: 'true',
                    originalWidth: metadata.width?.toString() || '',
                    originalHeight: metadata.height?.toString() || ''
                  },
                })
                console.log('✅ Image thumbnail generated and uploaded:', {
                  url,
                  originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
                  thumbnailSize: `${(thumbnailSize / 1024).toFixed(2)} KB`,
                  reduction: `${((1 - thumbnailSize / originalSize) * 100).toFixed(1)}%`
                })
                return { buffer: thumb, url }
              }
            }
            return null
          })()
        ])
        
        // Processar resultados
        if (previewResult.status === 'fulfilled' && previewResult.value) {
          previewBuffer = previewResult.value.buffer
          previewUrl = previewResult.value.url
        } else if (previewResult.status === 'rejected') {
          console.warn('⚠️ Failed to create watermarked preview:', previewResult.reason)
        }
        
        if (thumbnailResult.status === 'fulfilled' && thumbnailResult.value) {
          thumbnailBuffer = thumbnailResult.value.buffer
          thumbnailUrl = thumbnailResult.value.url
        } else if (thumbnailResult.status === 'rejected') {
          console.warn('⚠️ Failed to generate image thumbnail:', thumbnailResult.reason)
        }
      } catch (error: any) {
        console.warn('⚠️ Failed to process image:', error.message)
        // Continuar mesmo se falhar
      }
    }
    
    // 3.2. Processamento de vídeo (marca d'água e thumbnail)
    if (type === 'resource' && file.type.startsWith('video/') && buffer) {
      const ffmpegAvailable = await checkFfmpegAvailable()
      if (ffmpegAvailable) {
        console.log('🎬 Starting video processing (watermark + thumbnail)...')
        const processingStartTime = Date.now()
        
        // Processar marca d'água, preview de vídeo (metade) e thumbnail em paralelo para acelerar
        try {
          const [previewResult, videoPreviewResult, thumbnailResult] = await Promise.allSettled([
            // 3.1. Criar versão com marca d'água para preview completo
            (async () => {
              console.log('💧 Creating watermarked preview version...')
              const watermarked = await addWatermarkToVideo(buffer, previewExtension || 'mp4', 'BRASILPSD')
              if (watermarked && watermarked.length > 0) {
                const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
                const previewKey = `previews/${user.id}/${previewFileName}`
                const url = await uploadFileToS3({
                  file: watermarked,
                  key: previewKey,
                  contentType: 'video/mp4',
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isPreview: 'true'
                  },
                })
                console.log('✅ Preview with watermark uploaded:', url)
                return { buffer: watermarked, url }
              }
              return null
            })(),
            // 3.2. Gerar preview de vídeo (metade do vídeo) para thumbnail
            (async () => {
              console.log('🎬 Generating video preview (half of video) for thumbnail...')
              const videoPreview = await generateVideoPreview(buffer, previewExtension || 'mp4', videoMetadata?.duration)
              if (videoPreview && videoPreview.length > 0) {
                // Adicionar marca d'água ao preview também
                const watermarkedPreview = await addWatermarkToVideo(videoPreview, 'mp4', 'BRASILPSD')
                const finalPreview = watermarkedPreview || videoPreview
                
                const previewFileName = `video-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
                const previewKey = `video-previews/${user.id}/${previewFileName}`
                const url = await uploadFileToS3({
                  file: finalPreview,
                  key: previewKey,
                  contentType: 'video/mp4',
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isVideoPreview: 'true'
                  },
                })
                console.log('✅ Video preview (half) uploaded:', url)
                return { buffer: finalPreview, url }
              }
              return null
            })(),
            // 3.3. Extrair thumbnail do primeiro frame (fallback)
            (async () => {
              console.log('🖼️ Extracting video thumbnail from first frame...')
              const thumb = await extractVideoThumbnail(buffer, previewExtension || 'mp4', 'jpeg', 85)
              if (thumb && thumb.length > 0) {
                const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
                const thumbnailKey = `thumbnails/${user.id}/${thumbnailFileName}`
                const url = await uploadFileToS3({
                  file: thumb,
                  key: thumbnailKey,
                  contentType: 'image/jpeg',
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isThumbnail: 'true'
                  },
                })
                console.log('✅ Thumbnail uploaded:', url)
                return { buffer: thumb, url }
              }
              return null
            })()
          ])
          
          // Processar resultados
          let videoPreviewUrl: string | null = null
          
          if (previewResult.status === 'fulfilled' && previewResult.value) {
            previewBuffer = previewResult.value.buffer
            previewUrl = previewResult.value.url
          } else if (previewResult.status === 'rejected') {
            console.warn('⚠️ Failed to create watermarked preview:', previewResult.reason)
          }
          
          if (videoPreviewResult.status === 'fulfilled' && videoPreviewResult.value) {
            videoPreviewUrl = videoPreviewResult.value.url
            // Usar o preview de vídeo como thumbnail_url também (será um vídeo curto)
            thumbnailUrl = videoPreviewResult.value.url
            console.log('✅ Video preview (half) will be used as thumbnail')
          } else if (videoPreviewResult.status === 'rejected') {
            console.warn('⚠️ Failed to generate video preview:', videoPreviewResult.reason)
          }
          
          if (thumbnailResult.status === 'fulfilled' && thumbnailResult.value) {
            // Só usar thumbnail estático se o preview de vídeo falhou
            if (!videoPreviewUrl) {
              thumbnailBuffer = thumbnailResult.value.buffer
              thumbnailUrl = thumbnailResult.value.url
            }
          } else if (thumbnailResult.status === 'rejected') {
            console.warn('⚠️ Failed to extract thumbnail:', thumbnailResult.reason)
          }
          
          const processingTime = ((Date.now() - processingStartTime) / 1000).toFixed(2)
          console.log(`✅ Video processing completed in ${processingTime}s`)
        } catch (error: any) {
          console.error('❌ Error during video processing:', error.message)
          // Continuar mesmo se o processamento falhar
        }
      } else {
        console.warn('⚠️ FFmpeg not available, skipping video processing')
      }
    }

    // 3.3. Processamento de áudio (apenas metadata - marca d'água é feita cliente-side)
    let audioMetadata: { duration?: number; bitrate?: number; sampleRate?: number; channels?: number } | null = null
    
    if (type === 'resource' && file.type.startsWith('audio/') && buffer) {
      const ffmpegAvailable = await checkFfmpegAvailable()
      if (ffmpegAvailable) {
        console.log('🎵 Extracting audio metadata...')
        const processingStartTime = Date.now()
        
        try {
          // Apenas extrair metadados do áudio (rápido)
          // Marca d'água será aplicada cliente-side no AudioPlayer (já implementado)
          audioMetadata = await extractAudioMetadata(buffer, fileExtension || 'mp3')
          if (audioMetadata) {
            console.log('✅ Audio metadata extracted:', audioMetadata)
          }
          
          const processingTime = ((Date.now() - processingStartTime) / 1000).toFixed(2)
          console.log(`✅ Audio metadata extraction completed in ${processingTime}s`)
          console.log('ℹ️ Watermark will be applied client-side for preview')
        } catch (error: any) {
          console.error('❌ Error extracting audio metadata:', error.message)
          // Continuar mesmo se a extração de metadata falhar
        }
      } else {
        console.warn('⚠️ FFmpeg not available, skipping audio metadata extraction')
      }
    }

    // 4. Upload do arquivo original (sem marca d'água) para download autorizado
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${previewExtension}`
    const fileKey = type === 'thumbnail' ? `thumbnails/${user.id}/${fileName}` : `resources/${user.id}/${fileName}`

    console.log('☁️ Uploading original file to S3:', {
      key: fileKey,
      contentType: contentType,
      extension: previewExtension,
      originalExtension: fileExtension,
      wasConverted: wasConverted,
      size: buffer.length,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    })

    const s3StartTime = Date.now()
    const fileUrl = await uploadFileToS3({
      file: buffer,
      key: fileKey,
      contentType: contentType,
      metadata: {
        userId: user.id,
        originalName: file.name,
        isAiGenerated: isAiGenerated.toString()
      },
    })

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    const s3Time = ((Date.now() - s3StartTime) / 1000).toFixed(2)
    
    console.log('✅ Upload successful!', {
      url: fileUrl,
      key: fileKey,
      totalTime: `${totalTime}s`,
      s3Time: `${s3Time}s`,
      videoMetadata: videoMetadata
    })

    return NextResponse.json({ 
      url: fileUrl, 
      key: fileKey,
      previewUrl: previewUrl || undefined, // URL da versão completa com marca d'água
      thumbnailUrl: thumbnailUrl || undefined, // URL do preview de vídeo (metade) ou thumbnail estático
      isAiGenerated,
      videoMetadata: videoMetadata || undefined,
      audioMetadata: audioMetadata || undefined,
      wasProcessed: !!(previewUrl || thumbnailUrl) // Indica se foi processado
    })
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error('❌ Upload error:', {
      message: error.message,
      stack: error.stack,
      totalTime: `${totalTime}s`,
      errorName: error.name,
      errorCode: error.code
    })
    
    // Retornar erro mais detalhado
    let errorMessage = error.message || 'Falha ao enviar arquivo'
    
    // Mensagens de erro mais amigáveis
    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      errorMessage = 'Tempo de upload excedido. Tente novamente com um arquivo menor ou verifique sua conexão.'
    } else if (error.message?.includes('ECONNRESET') || error.code === 'ECONNRESET') {
      errorMessage = 'Conexão interrompida. Verifique sua internet e tente novamente.'
    } else if (error.message?.includes('ENOENT') || error.code === 'ENOENT') {
      errorMessage = 'Erro ao processar arquivo. Verifique se o arquivo não está corrompido.'
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      errorCode: error.code
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3 } from '@/lib/aws/s3'
import sharp from 'sharp'
import { convertVideoToMp4, checkFfmpegAvailable, extractVideoMetadata } from '@/lib/video/convert'
import { addWatermarkToVideo } from '@/lib/video/watermark'
import { extractVideoThumbnail } from '@/lib/video/thumbnail'
import { generateVideoPreview } from '@/lib/video/preview'
import { addWatermarkToAudio, extractAudioMetadata } from '@/lib/audio/watermark'
import { generateDesignFileThumbnail } from '@/lib/design/thumbnail'
import { isDesignFileFormatSupported } from '@/lib/design/formats'

export const maxDuration = 300 // 5 minutos para uploads grandes
export const runtime = 'nodejs'

/**
 * NOTA: O Next.js/Vercel tem um limite de 4.5MB para o body das requisições.
 * Arquivos maiores que isso resultarão em erro 413 (Content Too Large) antes
 * mesmo de chegar neste handler. Para arquivos grandes (>4.5MB), é necessário
 * usar upload direto ao S3 via presigned URL (/api/upload/presigned).
 */
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
    
    // Tentar ler o Content-Length do header para detectar arquivos grandes
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024)
      if (sizeInMB > 4.5) {
        console.warn(`⚠️ File too large: ${sizeInMB.toFixed(2)}MB (limit: 4.5MB)`)
        return NextResponse.json({
          error: 'Arquivo muito grande',
          message: `O arquivo (${sizeInMB.toFixed(2)}MB) excede o limite de 4.5MB. Para arquivos grandes, use upload direto ao S3 via presigned URL.`,
          maxSize: 4.5 * 1024 * 1024,
          fileSize: parseInt(contentLength),
          usePresignedUrl: true
        }, { status: 413 })
      }
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const noWatermark = formData.get('noWatermark') === 'true' // Flag para não adicionar marca d'água

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

    // Garantir Content-Type correto para arquivos .zip (projetos completos)
    if (type === 'resource' && fileExtension === 'zip') {
      contentType = 'application/zip'
      console.log('Set .zip Content-Type to:', contentType)
    }

    // Garantir Content-Type correto para arquivos .aep (After Effects) - mantido para compatibilidade
    if (type === 'resource' && fileExtension === 'aep') {
      contentType = 'application/octet-stream'
      console.log('Set .aep Content-Type to:', contentType)
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
        // Criar marca d'água em padrão de grid (quadrados com linhas) - tamanho maior para menos repetição
        const watermarkTile = Buffer.from(`
          <svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
            <!-- Linhas horizontais -->
            <line x1="0" y1="0" x2="1200" y2="0" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="300" x2="1200" y2="300" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="600" x2="1200" y2="600" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="900" x2="1200" y2="900" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="1200" x2="1200" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <!-- Linhas verticais -->
            <line x1="0" y1="0" x2="0" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="300" y1="0" x2="300" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="600" y1="0" x2="600" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="900" y1="0" x2="900" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="1200" y1="0" x2="1200" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <!-- Texto no centro -->
            <text 
              x="50%" 
              y="50%" 
              font-family="Arial, sans-serif" 
              font-weight="600" 
              font-size="180" 
              fill="rgba(255,255,255,0.05)" 
              text-anchor="middle" 
              dominant-baseline="middle"
              transform="rotate(-30 600 600)"
            >
              BRASILPSD
            </text>
          </svg>
        `)

        // Otimizar: verificar dimensões antes de processar
        const image = sharp(buffer)
        const metadata = await image.metadata()
        
        // Detectar se a imagem tem transparência (canal alpha)
        const hasAlpha = metadata.hasAlpha === true
        const isPng = fileExtension === 'png' || metadata.format === 'png'
        const preserveTransparency = hasAlpha && isPng
        
        console.log('🖼️ Thumbnail transparency check:', {
          hasAlpha,
          isPng,
          preserveTransparency,
          format: metadata.format
        })
        
        // Se a imagem já for pequena (menos de 1200px), não redimensionar
        const needsResize = (metadata.width && metadata.width > 1200) || (metadata.height && metadata.height > 1200)
        
        let pipeline = image
        if (needsResize) {
          pipeline = pipeline.resize(1200, 1200, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
        }
        
        // Se for PNG com transparência, garantir que o canal alpha seja preservado
        if (preserveTransparency) {
          pipeline = pipeline.ensureAlpha()
        }
        
        // Aplicar watermark
        pipeline = pipeline.composite([{ 
          input: watermarkTile, 
          tile: true,
          blend: 'over' 
        }])
        
        // Escolher formato baseado na transparência
        let processedBuffer: Buffer
        if (preserveTransparency) {
          // Preservar transparência usando PNG
          processedBuffer = await pipeline
            .png({ 
              quality: 90,
              compressionLevel: 6,
              adaptiveFiltering: true
            })
            .toBuffer()
          contentType = 'image/png'
          fileExtension = 'png'
        } else {
          // Sem transparência, usar WebP (melhor compressão)
          processedBuffer = await pipeline
            .webp({ quality: 75, effort: 4 })
            .toBuffer()
          contentType = 'image/webp'
          fileExtension = 'webp'
        }
        
        buffer = Buffer.from(processedBuffer)
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
    
    // Se for noWatermark, pular conversão para preservar proporção original
    const shouldSkipConversion = noWatermark && file.type.startsWith('video/')
    
    if (type === 'resource' && file.type.startsWith('video/') && fileExtension && !shouldSkipConversion) {
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
    let imageMetadata: { width?: number, height?: number } | null = null
    
    // 3.1. Processar imagens: criar preview com marca d'água e thumbnail
    if (type === 'resource' && file.type.startsWith('image/') && buffer) {
      try {
        console.log('🖼️ Processing image: watermark + thumbnail...')
        const image = sharp(buffer)
        const metadata = await image.metadata()
        
        // Extrair dimensões da imagem
        if (metadata.width && metadata.height) {
          imageMetadata = {
            width: metadata.width,
            height: metadata.height
          }
          console.log('📐 Image dimensions extracted:', imageMetadata)
        }
        
        // Criar marca d'água em padrão de grid (quadrados com linhas) - tamanho maior para menos repetição
        const watermarkTile = Buffer.from(`
          <svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
            <!-- Linhas horizontais -->
            <line x1="0" y1="0" x2="1200" y2="0" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="300" x2="1200" y2="300" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="600" x2="1200" y2="600" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="900" x2="1200" y2="900" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="0" y1="1200" x2="1200" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <!-- Linhas verticais -->
            <line x1="0" y1="0" x2="0" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="300" y1="0" x2="300" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="600" y1="0" x2="600" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="900" y1="0" x2="900" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="1200" y1="0" x2="1200" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <!-- Texto no centro -->
            <text 
              x="50%" 
              y="50%" 
              font-family="Arial, sans-serif" 
              font-weight="600" 
              font-size="180" 
              fill="rgba(255,255,255,0.05)" 
              text-anchor="middle" 
              dominant-baseline="middle"
              transform="rotate(-30 600 600)"
            >
              BRASILPSD
            </text>
          </svg>
        `)
        
        // Detectar se a imagem tem transparência (canal alpha)
        const hasAlpha = metadata.hasAlpha === true
        const isPng = fileExtension === 'png' || metadata.format === 'png'
        const preserveTransparency = hasAlpha && isPng
        
        console.log('🖼️ Image transparency check:', {
          hasAlpha,
          isPng,
          preserveTransparency,
          format: metadata.format,
          channels: metadata.channels
        })
        
        // Processar preview com marca d'água e thumbnail em paralelo
        const [previewResult, thumbnailResult] = await Promise.allSettled([
          // 3.1.1. Criar versão com marca d'água para preview
          (async () => {
            console.log('💧 Creating watermarked preview for image...')
            let processedImage = image.clone()
            
            // Se for PNG com transparência, garantir que o canal alpha seja preservado
            if (preserveTransparency) {
              processedImage = processedImage.ensureAlpha()
            }
            
            const watermarked = await processedImage
              .composite([{ 
                input: watermarkTile, 
                tile: true,
                blend: 'over' 
              }])
              .toBuffer()
            
            if (watermarked && watermarked.length > 0) {
              // Preservar formato original se for PNG com transparência
              const previewExtension = preserveTransparency ? 'png' : (fileExtension || 'jpg')
              const previewContentType = preserveTransparency ? 'image/png' : contentType
              
              const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.${previewExtension}`
              const previewKey = `previews/${user.id}/${previewFileName}`
              const url = await uploadFileToS3({
                file: watermarked,
                key: previewKey,
                contentType: previewContentType,
                metadata: {
                  userId: user.id,
                  originalName: file.name,
                  isPreview: 'true',
                  hasAlpha: preserveTransparency ? 'true' : 'false'
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
            
            // Criar pipeline de processamento
            let thumbPipeline = image
              .clone()
              .resize(targetWidth, targetHeight, {
                fit: 'inside',
                withoutEnlargement: true
              })
            
            // Se for PNG com transparência, manter como PNG
            // Caso contrário, converter para JPEG (menor tamanho)
            let thumb: Buffer
            let thumbExtension: string
            let thumbContentType: string
            
            if (preserveTransparency) {
              // Preservar transparência usando PNG
              thumb = await thumbPipeline
                .ensureAlpha() // Garantir que o canal alpha existe
                .png({ 
                  quality: 90,
                  compressionLevel: 6,
                  adaptiveFiltering: true
                })
                .toBuffer()
              thumbExtension = 'png'
              thumbContentType = 'image/png'
            } else {
              // Sem transparência, usar JPEG (menor tamanho)
              thumb = await thumbPipeline
                .jpeg({ 
                  quality: 75,
                  mozjpeg: true,
                  progressive: true
                })
                .toBuffer()
              thumbExtension = 'jpg'
              thumbContentType = 'image/jpeg'
            }
            
            const originalSize = buffer.length
            const thumbnailSize = thumb.length
            
            if (thumb && thumb.length > 0) {
              // Só usar o thumbnail se ele for menor que o original
              if (thumbnailSize < originalSize * 0.8 || originalSize > 500 * 1024) {
                const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.${thumbExtension}`
                const thumbnailKey = `thumbnails/${user.id}/${thumbnailFileName}`
                const url = await uploadFileToS3({
                  file: thumb,
                  key: thumbnailKey,
                  contentType: thumbContentType,
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isThumbnail: 'true',
                    originalWidth: metadata.width?.toString() || '',
                    originalHeight: metadata.height?.toString() || '',
                    hasAlpha: preserveTransparency ? 'true' : 'false'
                  },
                })
                console.log('✅ Image thumbnail generated and uploaded:', {
                  url,
                  format: thumbExtension,
                  hasTransparency: preserveTransparency,
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
        console.log(`🎬 Starting video processing (${noWatermark ? 'no watermark' : 'watermark + thumbnail'})...`)
        const processingStartTime = Date.now()
        
        // Processar marca d'água, preview de vídeo (metade) e thumbnail em paralelo para acelerar
        try {
          const [previewResult, videoPreviewResult, thumbnailResult] = await Promise.allSettled([
            // 3.1. Criar versão com ou sem marca d'água para preview completo
            (async () => {
              if (noWatermark) {
                // Se não deve ter marca d'água, usar o buffer original (sem conversão) para preservar proporção
                // Se o vídeo já foi convertido, usar o convertido, mas garantir que as dimensões estão corretas
                console.log('📹 Uploading video without watermark (preserving original aspect ratio)...')
                const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
                const previewKey = `previews/${user.id}/${previewFileName}`
                
                // Para noWatermark, sempre usar o buffer original (antes de qualquer conversão)
                // Isso preserva a proporção original do vídeo
                const videoBuffer = originalBuffer || buffer
                const videoContentType = file.type || 'video/mp4'
                const videoExtension = fileExtension || 'mp4'
                
                const url = await uploadFileToS3({
                  file: videoBuffer,
                  key: previewKey,
                  contentType: videoContentType,
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isPreview: 'true',
                    noWatermark: 'true'
                  },
                })
                console.log('✅ Preview without watermark uploaded (original aspect ratio preserved):', url)
                return { buffer: videoBuffer, url }
              } else {
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
              }
              return null
            })(),
            // 3.2. Gerar preview de vídeo (metade do vídeo) para thumbnail
            (async () => {
              console.log('🎬 Generating video preview (half of video) for thumbnail...')
              const videoPreview = await generateVideoPreview(buffer, previewExtension || 'mp4', videoMetadata?.duration)
              if (videoPreview && videoPreview.length > 0) {
                // Adicionar marca d'água ao preview apenas se não for especificado noWatermark
                let finalPreview = videoPreview
                if (!noWatermark) {
                  const watermarkedPreview = await addWatermarkToVideo(videoPreview, 'mp4', 'BRASILPSD')
                  finalPreview = watermarkedPreview || videoPreview
                }
                
                const previewFileName = `video-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
                const previewKey = `video-previews/${user.id}/${previewFileName}`
                const url = await uploadFileToS3({
                  file: finalPreview,
                  key: previewKey,
                  contentType: 'video/mp4',
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isVideoPreview: 'true',
                    noWatermark: noWatermark ? 'true' : 'false'
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
            // Se noWatermark for true, usar o previewUrl como o vídeo sem marca d'água
            if (noWatermark) {
              // O previewUrl já contém o vídeo sem marca d'água
              console.log('✅ Video preview without watermark set as previewUrl')
            }
          } else if (previewResult.status === 'rejected') {
            console.warn('⚠️ Failed to create preview:', previewResult.reason)
            // Se noWatermark e preview falhou, usar o buffer original como fallback
            if (noWatermark) {
              const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
              const previewKey = `previews/${user.id}/${previewFileName}`
              try {
                const url = await uploadFileToS3({
                  file: buffer,
                  key: previewKey,
                  contentType: 'video/mp4',
                  metadata: {
                    userId: user.id,
                    originalName: file.name,
                    isPreview: 'true',
                    noWatermark: 'true'
                  },
                })
                previewUrl = url
                console.log('✅ Fallback: Video without watermark uploaded as preview')
              } catch (error: any) {
                console.error('❌ Failed to upload fallback preview:', error.message)
              }
            }
          }
          
          if (videoPreviewResult.status === 'fulfilled' && videoPreviewResult.value) {
            videoPreviewUrl = videoPreviewResult.value.url
            // Usar o preview de vídeo como thumbnail_url também (será um vídeo curto)
            // Mas apenas se não tiver noWatermark (para manter consistência)
            if (!noWatermark) {
              thumbnailUrl = videoPreviewResult.value.url
            }
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

    // 3.4. Processamento de arquivos de design (PSD, AI, EPS, SVG) - Geração automática de thumbnails
    // Similar ao que grandes players como Freepik e Envato fazem
    if (type === 'resource' && fileExtension && isDesignFileFormatSupported(fileExtension) && buffer) {
      console.log(`🎨 Processing design file (${fileExtension.toUpperCase()}) for automatic thumbnail generation...`)
      console.log(`📊 File info: name=${file.name}, size=${buffer.length} bytes, extension=${fileExtension}`)
      const designProcessingStartTime = Date.now()
      
      try {
        // Gerar thumbnail automaticamente do arquivo de design
        console.log(`🔄 Calling generateDesignFileThumbnail for ${fileExtension}...`)
        const designThumbnail = await generateDesignFileThumbnail(
          buffer,
          fileExtension,
          file.name,
          {
            width: 1200,
            height: 1200,
            quality: 85,
            format: 'jpeg'
          }
        )
        
        console.log(`📊 Thumbnail generation result: ${designThumbnail ? `success (${designThumbnail.length} bytes)` : 'failed'}`)
        
        if (designThumbnail && designThumbnail.length > 0) {
          console.log('✅ Design file thumbnail generated:', designThumbnail.length, 'bytes')
          
          // Upload do thumbnail gerado automaticamente
          const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
          const thumbnailKey = `thumbnails/${user.id}/${thumbnailFileName}`
          const thumbnailUrlResult = await uploadFileToS3({
            file: designThumbnail,
            key: thumbnailKey,
            contentType: 'image/jpeg',
            metadata: {
              userId: user.id,
              originalName: file.name,
              isThumbnail: 'true',
              autoGenerated: 'true',
              sourceFormat: fileExtension
            },
          })
          
          thumbnailUrl = thumbnailUrlResult
          thumbnailBuffer = designThumbnail
          
          console.log('✅ Design file thumbnail uploaded:', thumbnailUrlResult)
          
          // Para arquivos de design, também criar preview com marca d'água (similar a imagens)
          try {
            const watermarkTile = Buffer.from(`
              <svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
                <!-- Linhas horizontais -->
                <line x1="0" y1="0" x2="1200" y2="0" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="0" y1="300" x2="1200" y2="300" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="0" y1="600" x2="1200" y2="600" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="0" y1="900" x2="1200" y2="900" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="0" y1="1200" x2="1200" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <!-- Linhas verticais -->
                <line x1="0" y1="0" x2="0" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="300" y1="0" x2="300" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="600" y1="0" x2="600" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="900" y1="0" x2="900" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="1200" y1="0" x2="1200" y2="1200" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <!-- Texto no centro -->
                <text 
                  x="50%" 
                  y="50%" 
                  font-family="Arial, sans-serif" 
                  font-weight="600" 
                  font-size="180" 
                  fill="rgba(255,255,255,0.05)" 
                  text-anchor="middle" 
                  dominant-baseline="middle"
                  transform="rotate(-30 600 600)"
                >
                  BRASILPSD
                </text>
              </svg>
            `)
            
            const watermarkedPreview = await sharp(designThumbnail)
              .composite([{ 
                input: watermarkTile, 
                tile: true,
                blend: 'over' 
              }])
              .webp({ quality: 75, effort: 4 })
              .toBuffer()
            
            if (watermarkedPreview && watermarkedPreview.length > 0) {
              const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`
              const previewKey = `previews/${user.id}/${previewFileName}`
              const previewUrlResult = await uploadFileToS3({
                file: watermarkedPreview,
                key: previewKey,
                contentType: 'image/webp',
                metadata: {
                  userId: user.id,
                  originalName: file.name,
                  isPreview: 'true',
                  sourceFormat: fileExtension
                },
              })
              
              previewUrl = previewUrlResult
              previewBuffer = watermarkedPreview
              console.log('✅ Design file preview with watermark uploaded:', previewUrlResult)
            }
          } catch (previewError: any) {
            console.warn('⚠️ Failed to create watermarked preview for design file:', previewError.message)
            // Continuar mesmo se preview falhar
          }
          
          const processingTime = ((Date.now() - designProcessingStartTime) / 1000).toFixed(2)
          console.log(`✅ Design file processing completed in ${processingTime}s`)
        } else {
          console.warn('⚠️ Failed to generate thumbnail for design file')
        }
      } catch (error: any) {
        console.error('❌ Error processing design file:', error.message)
        // Continuar mesmo se o processamento falhar (não bloquear upload)
      }
    }

    // 4. Upload do arquivo original (sem marca d'água) para download autorizado
    // Para PNGs com transparência, garantir que o formato seja preservado
    let finalBuffer = buffer
    let finalExtension = previewExtension || fileExtension || 'jpg'
    let finalContentType = contentType
    
    // Se for PNG com transparência, garantir que está usando o buffer original e formato PNG
    if (type === 'resource' && file.type.startsWith('image/')) {
      try {
        const imageMetadata = await sharp(buffer).metadata()
        const hasAlpha = imageMetadata.hasAlpha === true
        const isPng = fileExtension === 'png' || imageMetadata.format === 'png'
        
        if (hasAlpha && isPng) {
          // Para PNGs com transparência, usar o buffer original e garantir formato PNG
          console.log('🖼️ Preserving PNG with transparency for original file')
          finalExtension = 'png'
          finalContentType = 'image/png'
          
          // Se o buffer foi modificado (ex: conversão de vídeo), garantir que seja PNG
          if (previewExtension !== 'png') {
            finalBuffer = await sharp(buffer)
              .ensureAlpha()
              .png({ 
                quality: 100, // Máxima qualidade para arquivo original
                compressionLevel: 6,
                adaptiveFiltering: true
              })
              .toBuffer()
            console.log('✅ Converted back to PNG to preserve transparency')
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not check image metadata for original file:', err)
        // Continuar com o buffer atual se houver erro
      }
    }
    
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${finalExtension}`
    const fileKey = type === 'thumbnail' ? `thumbnails/${user.id}/${fileName}` : `resources/${user.id}/${fileName}`

    console.log('☁️ Uploading original file to S3:', {
      key: fileKey,
      contentType: finalContentType,
      extension: finalExtension,
      originalExtension: fileExtension,
      wasConverted: wasConverted,
      size: finalBuffer.length,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    })

    const s3StartTime = Date.now()
    const fileUrl = await uploadFileToS3({
      file: finalBuffer,
      key: fileKey,
      contentType: finalContentType,
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
      imageMetadata: imageMetadata || undefined, // Dimensões da imagem
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

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { downloadFileFromS3, uploadFileToS3, getS3Url } from '@/lib/aws/s3'
import sharp from 'sharp'
import { detectAiGeneratedImage } from '@/lib/utils/ai-image-detector'

export const maxDuration = 300 // 5 minutos
export const runtime = 'nodejs'

/**
 * Processa um arquivo já enviado ao S3 (via presigned URL)
 * Gera preview, thumbnail e detecta se foi gerado por IA
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { key, fileName, contentType, type } = await request.json()

    if (!key) {
      return NextResponse.json({ error: 'Key do S3 é obrigatória' }, { status: 400 })
    }

    console.log('🔄 Processando arquivo do S3:', { key, fileName, contentType })

    // 1. Baixar arquivo do S3
    const fileBuffer = await downloadFileFromS3(key)
    console.log('✅ Arquivo baixado do S3:', fileBuffer.length, 'bytes')

    // 2. Detectar se foi gerado por IA (apenas para imagens)
    let isAiGenerated = false
    let imageMetadata: any = null

    if (contentType?.startsWith('image/')) {
      try {
        const aiDetection = await detectAiGeneratedImage(fileBuffer)
        isAiGenerated = aiDetection.isAiGenerated
        console.log('🤖 AI Detection result:', {
          isAiGenerated,
          confidence: aiDetection.confidence,
          reasons: aiDetection.reasons
        })

        // Extrair metadados da imagem
        const image = sharp(fileBuffer)
        const metadata = await image.metadata()
        imageMetadata = {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        }
      } catch (error) {
        console.warn('⚠️ Erro ao detectar IA ou extrair metadados:', error)
      }
    }

    // 3. Gerar preview e thumbnail (apenas para imagens)
    let previewUrl: string | null = null
    let thumbnailUrl: string | null = null

    if (contentType?.startsWith('image/') && type === 'resource') {
      try {
        const image = sharp(fileBuffer)
        const metadata = await image.metadata()
        const hasAlpha = metadata.hasAlpha === true
        const isPng = fileName?.toLowerCase().endsWith('.png') || metadata.format === 'png'
        const preserveTransparency = hasAlpha && isPng

        // Gerar thumbnail (1200px max)
        const needsResize = (metadata.width && metadata.width > 1200) || (metadata.height && metadata.height > 1200)
        let thumbnailPipeline = image
        if (needsResize) {
          thumbnailPipeline = thumbnailPipeline.resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
        }

        if (preserveTransparency) {
          thumbnailPipeline = thumbnailPipeline.ensureAlpha()
        }

        const thumbnailBuffer = preserveTransparency
          ? await thumbnailPipeline.png({ quality: 90, compressionLevel: 6, adaptiveFiltering: true }).toBuffer()
          : await thumbnailPipeline.webp({ quality: 75, effort: 4 }).toBuffer()

        const thumbnailKey = `thumbnails/${Date.now()}-${Math.random().toString(36).substring(7)}.${preserveTransparency ? 'png' : 'webp'}`
        thumbnailUrl = await uploadFileToS3({
          file: thumbnailBuffer,
          key: thumbnailKey,
          contentType: preserveTransparency ? 'image/png' : 'image/webp',
          metadata: {
            userId: user.id,
            originalName: fileName,
            isThumbnail: 'true'
          }
        })

        // Gerar preview com marca d'água (similar ao upload normal)
        // Por enquanto, usar o mesmo thumbnail como preview
        previewUrl = thumbnailUrl

        console.log('✅ Preview e thumbnail gerados')
      } catch (error) {
        console.warn('⚠️ Erro ao gerar preview/thumbnail:', error)
      }
    }

    return NextResponse.json({
      previewUrl,
      thumbnailUrl,
      isAiGenerated,
      imageMetadata
    })
  } catch (error: any) {
    console.error('❌ Erro ao processar arquivo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar arquivo' },
      { status: 500 }
    )
  }
}

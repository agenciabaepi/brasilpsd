import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3, getS3Url } from '@/lib/aws/s3'
import sharp from 'sharp'

export const maxDuration = 300 // 5 minutos
export const runtime = 'nodejs'

/**
 * Gera thumbnails para imagens que não têm thumbnail_url
 * Apenas para admins
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { limit = 50, offset = 0 } = await request.json().catch(() => ({ limit: 50, offset: 0 }))

    // Buscar imagens sem thumbnail OU com thumbnail igual ao file_url (problema comum)
    const { data: allResources, error: fetchError } = await supabase
      .from('resources')
      .select('id, file_url, thumbnail_url, resource_type, creator_id')
      .eq('resource_type', 'image')
      .eq('status', 'approved')
      .range(offset, offset + limit - 1)

    if (fetchError) {
      console.error('Erro ao buscar recursos:', fetchError)
      return NextResponse.json({ error: 'Erro ao buscar recursos' }, { status: 500 })
    }

    // Filtrar recursos que não têm thumbnail OU têm thumbnail igual ao file_url
    const resources = (allResources || []).filter(resource => {
      if (!resource.thumbnail_url) return true
      // Verificar se thumbnail_url é igual ao file_url (mesmo caminho)
      // Normalizar URLs para comparar apenas as keys do S3
      const normalizeKey = (url: string) => {
        if (url.includes('amazonaws.com')) {
          return url.split('amazonaws.com/')[1]?.split('?')[0] || ''
        }
        if (url.includes('cloudfront.net')) {
          return url.split('cloudfront.net/')[1]?.split('?')[0] || ''
        }
        // Se não tiver domínio, assumir que já é uma key
        return url.split('?')[0]
      }
      
      const thumbnailKey = normalizeKey(resource.thumbnail_url)
      const fileKey = normalizeKey(resource.file_url)
      
      // Se as keys forem iguais, significa que o thumbnail é a mesma imagem
      return thumbnailKey === fileKey
    })

    if (!resources || resources.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhuma imagem sem thumbnail encontrada',
        processed: 0,
        total: 0
      })
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Processar cada imagem
    for (const resource of resources) {
      try {
        if (!resource.file_url) {
          results.failed++
          results.errors.push(`Recurso ${resource.id}: sem file_url`)
          continue
        }

        // Extrair a key do S3 da URL
        let imageKey = resource.file_url
        if (imageKey.startsWith('http')) {
          // Remover domínio e extrair apenas a key
          const url = new URL(imageKey)
          imageKey = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname
        }

        // Baixar a imagem do S3
        const { GetObjectCommand } = await import('@aws-sdk/client-s3')
        const { S3Client } = await import('@aws-sdk/client-s3')
        
        const REGION = process.env.AWS_REGION || 'us-east-2'
        const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'brasilpsd-arquivos'
        
        const s3Client = new S3Client({
          region: REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        })

        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: imageKey,
        })

        const response = await s3Client.send(getCommand)
        if (!response.Body) {
          results.failed++
          results.errors.push(`Recurso ${resource.id}: não foi possível baixar a imagem`)
          continue
        }

        // Converter stream para buffer
        const chunks: Buffer[] = []
        const stream = response.Body as any
        
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk))
        }
        
        const buffer = Buffer.concat(chunks)

        // Gerar thumbnail otimizado
        const metadata = await sharp(buffer).metadata()
        const maxThumbnailSize = 800
        let targetWidth = maxThumbnailSize
        let targetHeight = maxThumbnailSize
        
        // Se a imagem for menor que 800px, redimensionar para 70% do tamanho original
        // Isso garante que o thumbnail seja sempre menor que a original
        if (metadata.width && metadata.height) {
          if (metadata.width <= maxThumbnailSize && metadata.height <= maxThumbnailSize) {
            targetWidth = Math.max(400, Math.floor(metadata.width * 0.7))
            targetHeight = Math.max(400, Math.floor(metadata.height * 0.7))
          }
        }
        
        const thumbnailBuffer = await sharp(buffer)
          .resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: 75, // Qualidade reduzida para garantir menor tamanho
            mozjpeg: true,
            progressive: true // JPEG progressivo para melhor compressão
          })
          .toBuffer()
        
        // Verificar se o thumbnail é realmente menor que o original
        const originalSize = buffer.length
        const thumbnailSize = thumbnailBuffer.length
        
        // Só usar o thumbnail se ele for menor que o original
        if (thumbnailSize >= originalSize * 0.8 && originalSize <= 500 * 1024) {
          results.failed++
          results.errors.push(`Recurso ${resource.id}: thumbnail não é significativamente menor`)
          continue
        }

        // Upload do thumbnail
        const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        const thumbnailKey = `thumbnails/${resource.creator_id}/${thumbnailFileName}`
        const thumbnailUrl = await uploadFileToS3({
          file: thumbnailBuffer,
          key: thumbnailKey,
          contentType: 'image/jpeg',
          metadata: {
            userId: resource.creator_id,
            resourceId: resource.id,
            isThumbnail: 'true',
            generated: 'true'
          },
        })

        // Atualizar o recurso com o thumbnail
        const { error: updateError } = await supabase
          .from('resources')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', resource.id)

        if (updateError) {
          results.failed++
          results.errors.push(`Recurso ${resource.id}: erro ao atualizar - ${updateError.message}`)
        } else {
          results.processed++
          console.log(`✅ Thumbnail gerado para recurso ${resource.id}`)
        }
      } catch (error: any) {
        results.failed++
        results.errors.push(`Recurso ${resource.id}: ${error.message}`)
        console.error(`Erro ao processar recurso ${resource.id}:`, error)
      }
    }

    return NextResponse.json({
      message: `Processamento concluído`,
      processed: results.processed,
      failed: results.failed,
      total: resources.length,
      errors: results.errors.slice(0, 10) // Limitar a 10 erros para não sobrecarregar a resposta
    })
  } catch (error: any) {
    console.error('Erro ao gerar thumbnails:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao gerar thumbnails' 
    }, { status: 500 })
  }
}


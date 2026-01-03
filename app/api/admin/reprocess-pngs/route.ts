import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3, downloadFileFromS3, extractS3KeyFromUrl } from '@/lib/aws/s3'
import sharp from 'sharp'

export const maxDuration = 300 // 5 minutos
export const runtime = 'nodejs'

/**
 * Reprocessa PNGs para preservar transparência nos previews e thumbnails
 * Apenas para administradores
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
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 })
    }

    const { resourceId, limit = 10 } = await request.json().catch(() => ({ resourceId: null, limit: 10 }))

    // Buscar recursos PNG
    let query = supabase
      .from('resources')
      .select('id, file_url, preview_url, thumbnail_url, creator_id, file_format, resource_type')
      .or('file_format.eq.png,resource_type.eq.png')
      .eq('status', 'approved')
      .not('file_url', 'is', null)

    if (resourceId) {
      query = query.eq('id', resourceId)
    } else {
      query = query.limit(limit)
    }

    const { data: resources, error } = await query

    if (error) {
      console.error('Error fetching resources:', error)
      return NextResponse.json({ error: 'Erro ao buscar recursos' }, { status: 500 })
    }

    if (!resources || resources.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhum recurso PNG encontrado',
        processed: 0,
        errors: []
      })
    }

    console.log(`🔄 Iniciando reprocessamento de ${resources.length} PNG(s)...`)

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; error: string }>
    }

    // Criar marca d'água
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

    // Processar cada recurso
    for (const resource of resources) {
      try {
        console.log(`\n📸 Processando recurso ${resource.id}...`)

        // Extrair chave S3 do file_url
        const fileKey = extractS3KeyFromUrl(resource.file_url)
        if (!fileKey) {
          console.warn(`⚠️ Não foi possível extrair chave S3 de: ${resource.file_url}`)
          results.skipped++
          continue
        }

        // Baixar arquivo original do S3
        console.log(`⬇️ Baixando arquivo original: ${fileKey}`)
        const originalBuffer = await downloadFileFromS3(fileKey)

        // Verificar metadados da imagem
        const image = sharp(originalBuffer)
        const metadata = await image.metadata()
        
        const hasAlpha = metadata.hasAlpha === true
        const isPng = metadata.format === 'png' || resource.file_format === 'png'
        const preserveTransparency = hasAlpha && isPng

        console.log(`📊 Metadados:`, {
          format: metadata.format,
          hasAlpha,
          isPng,
          preserveTransparency,
          width: metadata.width,
          height: metadata.height
        })

        if (!preserveTransparency) {
          console.log(`⏭️ PNG sem transparência, pulando...`)
          results.skipped++
          continue
        }

        // Reprocessar preview com marca d'água
        console.log(`💧 Gerando preview com marca d'água...`)
        const watermarkedPreview = await image
          .clone()
          .ensureAlpha()
          .composite([{ 
            input: watermarkTile, 
            tile: true,
            blend: 'over' 
          }])
          .png({ 
            quality: 90,
            compressionLevel: 6,
            adaptiveFiltering: true
          })
          .toBuffer()

        // Upload do novo preview
        const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}.png`
        const previewKey = `previews/${resource.creator_id}/${previewFileName}`
        const previewUrl = await uploadFileToS3({
          file: watermarkedPreview,
          key: previewKey,
          contentType: 'image/png',
          metadata: {
            userId: resource.creator_id,
            isPreview: 'true',
            hasAlpha: 'true',
            reprocessed: 'true'
          },
        })

        // Gerar thumbnail
        console.log(`🖼️ Gerando thumbnail...`)
        const maxThumbnailSize = 800
        let targetWidth = maxThumbnailSize
        let targetHeight = maxThumbnailSize

        if (metadata.width && metadata.height) {
          if (metadata.width <= maxThumbnailSize && metadata.height <= maxThumbnailSize) {
            targetWidth = Math.max(400, Math.floor(metadata.width * 0.7))
            targetHeight = Math.max(400, Math.floor(metadata.height * 0.7))
          }
        }

        const thumbnail = await image
          .clone()
          .ensureAlpha()
          .resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ 
            quality: 90,
            compressionLevel: 6,
            adaptiveFiltering: true
          })
          .toBuffer()

        // Upload do novo thumbnail
        const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.png`
        const thumbnailKey = `thumbnails/${resource.creator_id}/${thumbnailFileName}`
        const thumbnailUrl = await uploadFileToS3({
          file: thumbnail,
          key: thumbnailKey,
          contentType: 'image/png',
          metadata: {
            userId: resource.creator_id,
            isThumbnail: 'true',
            hasAlpha: 'true',
            reprocessed: 'true',
            originalWidth: metadata.width?.toString() || '',
            originalHeight: metadata.height?.toString() || ''
          },
        })

        // Atualizar banco de dados
        console.log(`💾 Atualizando banco de dados...`)
        const { error: updateError } = await supabase
          .from('resources')
          .update({
            preview_url: previewUrl,
            thumbnail_url: thumbnailUrl
          })
          .eq('id', resource.id)

        if (updateError) {
          throw new Error(`Erro ao atualizar banco: ${updateError.message}`)
        }

        console.log(`✅ Recurso ${resource.id} reprocessado com sucesso!`)
        results.processed++

      } catch (error: any) {
        console.error(`❌ Erro ao processar recurso ${resource.id}:`, error)
        results.errors.push({
          id: resource.id,
          error: error.message || 'Erro desconhecido'
        })
      }
    }

    return NextResponse.json({
      message: `Reprocessamento concluído`,
      total: resources.length,
      processed: results.processed,
      skipped: results.skipped,
      errors: results.errors
    })

  } catch (error: any) {
    console.error('Erro no reprocessamento:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao reprocessar PNGs' },
      { status: 500 }
    )
  }
}


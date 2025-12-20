import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3 } from '@/lib/aws/s3'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile || (!profile.is_creator && !profile.is_admin)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)
    let contentType = file.type
    let fileExtension = file.name.split('.').pop()?.toLowerCase()
    let isAiGenerated = false

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
        // Criar apenas um "quadradinho" da marca d'água para repetir (Tiling)
        const watermarkTile = Buffer.from(`
          <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
            <text 
              x="50%" 
              y="50%" 
              font-family="sans-serif" 
              font-weight="900" 
              font-size="20" 
              fill="rgba(255,255,255,0.2)" 
              stroke="rgba(0,0,0,0.05)" 
              stroke-width="0.5" 
              text-anchor="middle" 
              transform="rotate(-30 150 100)"
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

    // 2. ZIP Compression - REMOVIDO para melhorar performance
    // Arquivos serão armazenados como original no S3
    // A compressão pode ser feita no cliente se necessário

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`
    const fileKey = type === 'thumbnail' ? `thumbnails/${user.id}/${fileName}` : `resources/${user.id}/${fileName}`

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

    return NextResponse.json({ url: fileUrl, key: fileKey, isAiGenerated })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message || 'Falha ao enviar arquivo' }, { status: 500 })
  }
}

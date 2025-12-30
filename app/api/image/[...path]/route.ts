import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'

const REGION = process.env.AWS_REGION || 'us-east-2'
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'brasilpsd-arquivos'

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

/**
 * API Route para servir imagens de forma protegida
 * - Gera signed URLs temporárias (15 minutos)
 * - Reduz qualidade automaticamente (75% por padrão)
 * - Adiciona headers de segurança
 * - Bloqueia acesso direto ao S3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Verificar autenticação (opcional, mas recomendado para previews)
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Se não estiver autenticado, ainda permitir acesso (para previews públicos)
    // Mas você pode mudar isso para exigir autenticação se necessário
    
    // Reconstruir o path do S3
    const s3Key = params.path.join('/')
    
    if (!s3Key || !s3Key.includes('preview') && !s3Key.includes('thumbnail')) {
      // Apenas permitir acesso a previews e thumbnails, nunca ao arquivo original
      return NextResponse.json(
        { error: 'Acesso negado. Apenas previews e thumbnails são permitidos.' },
        { status: 403 }
      )
    }

    // Obter parâmetros de query
    const searchParams = request.nextUrl.searchParams
    const quality = parseInt(searchParams.get('q') || '75', 10)
    const width = searchParams.get('w') ? parseInt(searchParams.get('w')!, 10) : undefined
    const expiresIn = 900 // 15 minutos

    // Gerar signed URL temporária
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    })

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn })

    // Buscar a imagem do S3
    const response = await fetch(signedUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar imagem' },
        { status: response.status }
      )
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/png'

    // Processar imagem com Sharp (reduzir qualidade e redimensionar se necessário)
    let processedImage = sharp(imageBuffer)

    // Redimensionar se width foi especificado
    if (width) {
      processedImage = processedImage.resize(width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    // Aplicar qualidade reduzida
    const outputOptions: sharp.OutputOptions = {
      quality: Math.max(60, Math.min(quality, 90)), // Limitar entre 60-90%
    }

    // Processar baseado no tipo
    let finalBuffer: Buffer
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      finalBuffer = await processedImage.jpeg(outputOptions).toBuffer()
    } else if (contentType.includes('png')) {
      finalBuffer = await processedImage.png({ 
        quality: outputOptions.quality,
        compressionLevel: 9 
      }).toBuffer()
    } else if (contentType.includes('webp')) {
      finalBuffer = await processedImage.webp(outputOptions).toBuffer()
    } else {
      // Se não for um formato suportado, retornar original
      finalBuffer = imageBuffer
    }

    // Headers de segurança
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Length', finalBuffer.length.toString())
    headers.set('Cache-Control', 'private, max-age=900, must-revalidate') // Cache de 15 minutos
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    // Bloquear download direto
    headers.set('Content-Disposition', 'inline')
    // Prevenir cache em navegadores
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    return new NextResponse(finalBuffer, {
      status: 200,
      headers,
    })
  } catch (error: any) {
    console.error('Erro ao servir imagem protegida:', error)
    return NextResponse.json(
      { error: 'Erro ao processar imagem' },
      { status: 500 }
    )
  }
}

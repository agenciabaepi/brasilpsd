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
    const quality = parseInt(searchParams.get('q') || '65', 10) // Reduzido de 75 para 65 (mais leve)
    const width = searchParams.get('w') ? parseInt(searchParams.get('w')!, 10) : undefined
    const expiresIn = 900 // 15 minutos

    // Detectar suporte a WebP via Accept header (mais eficiente que JPEG/PNG)
    const acceptHeader = request.headers.get('accept') || ''
    const supportsWebP = acceptHeader.includes('image/webp')
    const format = searchParams.get('f') || (supportsWebP ? 'webp' : null) // Permitir forçar formato via ?f=webp

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
    const originalContentType = response.headers.get('content-type') || 'image/png'

    // Processar imagem com Sharp (reduzir qualidade e redimensionar se necessário)
    let processedImage = sharp(imageBuffer)

    // Redimensionar se width foi especificado
    if (width) {
      processedImage = processedImage.resize(width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    // Aplicar qualidade reduzida (otimizada para WebP)
    const outputOptions: sharp.OutputOptions = {
      quality: Math.max(60, Math.min(quality, 90)), // Limitar entre 60-90%
    }

    // Processar baseado no formato desejado (priorizar WebP para melhor compressão)
    let finalBuffer: Buffer
    let finalContentType: string

    if (format === 'webp' || (supportsWebP && !format)) {
      // Converter para WebP (muito mais eficiente - ~30% menor que JPEG)
      finalBuffer = await processedImage.webp({
        quality: outputOptions.quality,
        effort: 4, // Balance entre velocidade e compressão (0-6)
      }).toBuffer()
      finalContentType = 'image/webp'
    } else if (originalContentType.includes('jpeg') || originalContentType.includes('jpg')) {
      finalBuffer = await processedImage.jpeg(outputOptions).toBuffer()
      finalContentType = 'image/jpeg'
    } else if (originalContentType.includes('png')) {
      finalBuffer = await processedImage.png({ 
        quality: outputOptions.quality,
        compressionLevel: 6 // Reduzido de 9 para 6 (mais rápido, ainda bom)
      }).toBuffer()
      finalContentType = 'image/png'
    } else if (originalContentType.includes('webp')) {
      finalBuffer = await processedImage.webp(outputOptions).toBuffer()
      finalContentType = 'image/webp'
    } else {
      // Se não for um formato suportado, retornar original
      finalBuffer = imageBuffer
      finalContentType = originalContentType
    }

    // Headers de segurança e cache otimizado
    const headers = new Headers()
    headers.set('Content-Type', finalContentType)
    headers.set('Content-Length', finalBuffer.length.toString())
    // Cache público mais longo (1 hora) - imagens são estáticas
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    // Bloquear download direto
    headers.set('Content-Disposition', 'inline')
    // Vary header para cache correto baseado em Accept
    if (supportsWebP) {
      headers.set('Vary', 'Accept')
    }

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

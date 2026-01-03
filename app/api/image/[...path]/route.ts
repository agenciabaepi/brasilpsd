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
    
    // Verificar se é um arquivo permitido
    const isPreview = s3Key.includes('preview')
    const isThumbnail = s3Key.includes('thumbnail')
    const isResource = s3Key.includes('resources/')
    const isPngResource = isResource && (s3Key.toLowerCase().endsWith('.png') || s3Key.toLowerCase().match(/\.png(\?|$)/))
    
    // Permitir: previews, thumbnails, e arquivos PNG originais (para preservar transparência)
    if (!s3Key || (!isPreview && !isThumbnail && !isPngResource)) {
      // Bloquear acesso a arquivos originais que não sejam PNG
      return NextResponse.json(
        { error: 'Acesso negado. Apenas previews, thumbnails e PNGs originais são permitidos.' },
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

    // Verificar se é PNG original (para preservar transparência sem processamento)
    const isOriginalPng = isPngResource && !isPreview && !isThumbnail
    
    // Se for PNG original, retornar sem processamento para preservar transparência
    if (isOriginalPng) {
      const headers = new Headers()
      headers.set('Content-Type', 'image/png')
      headers.set('Content-Length', imageBuffer.length.toString())
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-Frame-Options', 'DENY')
      headers.set('Content-Disposition', 'inline')
      
      return new NextResponse(imageBuffer, {
        status: 200,
        headers,
      })
    }

    // Processar imagem com Sharp (reduzir qualidade e redimensionar se necessário)
    let processedImage = sharp(imageBuffer)

    // Verificar se a imagem tem transparência (canal alpha)
    const metadata = await processedImage.metadata()
    const hasAlpha = metadata.hasAlpha === true
    const isPng = originalContentType.includes('png')

    // Redimensionar se width foi especificado
    if (width) {
      processedImage = processedImage.resize(width, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    // Se for PNG com transparência, garantir que o canal alpha seja preservado
    if (isPng && hasAlpha) {
      processedImage = processedImage.ensureAlpha()
    }

    // Aplicar qualidade reduzida (otimizada para WebP)
    const outputOptions: sharp.OutputOptions = {
      quality: Math.max(60, Math.min(quality, 90)), // Limitar entre 60-90%
    }

    // Processar baseado no formato desejado (priorizar WebP para melhor compressão)
    let finalBuffer: Buffer
    let finalContentType: string

    if (format === 'webp' || (supportsWebP && !format)) {
      // Para PNGs com transparência, NÃO converter para WebP (preservar PNG)
      if (isPng && hasAlpha) {
        finalBuffer = await processedImage.png({ 
          quality: 100, // Máxima qualidade para PNGs com transparência
          compressionLevel: 6,
          adaptiveFiltering: true
        }).toBuffer()
        finalContentType = 'image/png'
      } else {
        // Converter para WebP (muito mais eficiente - ~30% menor que JPEG)
        finalBuffer = await processedImage.webp({
          quality: outputOptions.quality,
          effort: 4, // Balance entre velocidade e compressão (0-6)
        }).toBuffer()
        finalContentType = 'image/webp'
      }
    } else if (originalContentType.includes('jpeg') || originalContentType.includes('jpg')) {
      finalBuffer = await processedImage.jpeg(outputOptions).toBuffer()
      finalContentType = 'image/jpeg'
    } else if (originalContentType.includes('png')) {
      // Para PNGs, preservar transparência se existir
      if (hasAlpha) {
        finalBuffer = await processedImage.png({ 
          quality: 100, // Máxima qualidade para PNGs com transparência
          compressionLevel: 6,
          adaptiveFiltering: true
        }).toBuffer()
      } else {
        finalBuffer = await processedImage.png({ 
          quality: outputOptions.quality,
          compressionLevel: 6
        }).toBuffer()
      }
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

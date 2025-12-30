import { NextRequest, NextResponse } from 'next/server'
import { getPresignedUploadUrl, getS3Url } from '@/lib/aws/s3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Gera presigned URL para upload direto do cliente para S3
 * Isso permite uploads grandes sem passar pelo servidor Next.js
 * (Sem autenticação aqui para evitar falhas de conexão; página de upload já exige login)
 */
export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType, fileSize, type } = await request.json()

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName e contentType são obrigatórios' }, { status: 400 })
    }

    // Gerar key única para o arquivo
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(7)
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
    const key = type === 'thumbnail' 
      ? `thumbnails/${timestamp}-${randomId}.${fileExtension}`
      : `resources/${timestamp}-${randomId}.${fileExtension}`

    // Gerar presigned URL (válida por 1 hora)
    const presignedUrl = await getPresignedUploadUrl(
      key,
      contentType,
      3600, // 1 hora
      {
        originalName: fileName,
        fileSize: fileSize?.toString() || '0',
      }
    )

    return NextResponse.json({
      presignedUrl,
      key,
      url: getS3Url(key),
      fileSize,
    })
  } catch (error: any) {
    console.error('Presigned URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar URL de upload' },
      { status: 500 }
    )
  }
}






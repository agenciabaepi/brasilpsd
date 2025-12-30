import { NextRequest, NextResponse } from 'next/server'
import { getSignedDownloadUrl } from '@/lib/aws/s3'
import { extractS3Key } from '@/lib/aws/s3-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileUrl = searchParams.get('fileUrl')

  if (!fileUrl) {
    return NextResponse.json({ error: 'fileUrl é obrigatório' }, { status: 400 })
  }

  // Extrair key
  const key = extractS3Key(fileUrl)
  if (!key) {
    return NextResponse.json({ error: 'Não foi possível extrair a chave do S3' }, { status: 400 })
  }

  try {
    const signedUrl = await getSignedDownloadUrl(key, 3600)
    return NextResponse.redirect(signedUrl, 302)
  } catch (error: any) {
    console.error('Erro ao gerar signed URL de vídeo:', error)
    return NextResponse.json({ error: 'Falha ao gerar URL assinada' }, { status: 500 })
  }
}


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
    // Gerar signed URL e fazer redirect para ela
    // Isso permite que o navegador carregue o vídeo diretamente do S3
    const signedUrl = await getSignedDownloadUrl(key, 3600)
    
    // Para vídeos, fazer redirect permanente (307) para manter o método GET
    // e permitir que o navegador carregue o vídeo diretamente
    return NextResponse.redirect(signedUrl, 307)
  } catch (error: any) {
    console.error('Erro ao gerar signed URL de vídeo:', error)
    return NextResponse.json({ error: 'Falha ao gerar URL assinada' }, { status: 500 })
  }
}


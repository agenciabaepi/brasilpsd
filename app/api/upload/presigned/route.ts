import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { getPresignedUploadUrl } from '@/lib/aws/s3'

export const runtime = 'nodejs'

/**
 * Gera presigned URL para upload direto do cliente para S3
 * Isso permite uploads grandes sem passar pelo servidor Next.js
 */
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

    const { fileName, contentType, fileSize, type } = await request.json()

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName e contentType são obrigatórios' }, { status: 400 })
    }

    // Gerar key única para o arquivo
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(7)
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
    const key = type === 'thumbnail' 
      ? `thumbnails/${user.id}/${timestamp}-${randomId}.${fileExtension}`
      : `resources/${user.id}/${timestamp}-${randomId}.${fileExtension}`

    // Gerar presigned URL (válida por 1 hora)
    const presignedUrl = await getPresignedUploadUrl(
      key,
      contentType,
      3600, // 1 hora
      {
        userId: user.id,
        originalName: fileName,
        fileSize: fileSize?.toString() || '0',
      }
    )

    return NextResponse.json({
      presignedUrl,
      key,
      url: `https://${process.env.AWS_S3_BUCKET_NAME || 'brasilpsd-arquivos'}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`
    })
  } catch (error: any) {
    console.error('Presigned URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar URL de upload' },
      { status: 500 }
    )
  }
}



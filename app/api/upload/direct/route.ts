import { NextRequest, NextResponse } from 'next/server'
import { uploadFileToS3 } from '@/lib/aws/s3'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string | null) || 'resource'

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(7)
    const ext = file.name.split('.').pop() || 'bin'

    const key =
      type === 'thumbnail'
        ? `thumbnails/${user.id}/${timestamp}-${randomId}.${ext}`
        : `resources/${user.id}/${timestamp}-${randomId}.${ext}`

    const url = await uploadFileToS3({
      file: buffer,
      key,
      contentType: file.type || 'application/octet-stream',
      metadata: {
        originalName: file.name,
        fileSize: buffer.length.toString(),
        userId: user.id,
        type,
      },
    })

    return NextResponse.json({
      url,
      key,
      presignedUrl: null,
    })
  } catch (error: any) {
    console.error('Upload direct error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 500 }
    )
  }
}


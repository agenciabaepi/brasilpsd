import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { extractImageMetadata } from '@/lib/image/metadata'

export const runtime = 'nodejs'
export const maxDuration = 10 // 10 segundos para extração de metadados

/**
 * Extrai metadados de uma imagem
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 })
    }

    // Converter arquivo para buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extrair metadados
    const metadata = await extractImageMetadata(buffer)

    return NextResponse.json({ 
      metadata: {
        ...metadata,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      }
    })
  } catch (error: any) {
    console.error('Error extracting metadata:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao extrair metadados' },
      { status: 500 }
    )
  }
}


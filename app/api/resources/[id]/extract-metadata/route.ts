import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { extractVideoMetadata } from '@/lib/video/convert'
import { getS3Url } from '@/lib/aws/s3'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin ou criador do recurso
    const { data: resource } = await supabase
      .from('resources')
      .select('id, file_url, resource_type, creator_id, width, height')
      .eq('id', params.id)
      .single()

    if (!resource) {
      return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 })
    }

    // Verificar permissão (admin ou criador)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.is_admin || false
    const isCreator = resource.creator_id === user.id

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: 'Apenas o criador ou administrador pode extrair metadados' }, { status: 403 })
    }

    // Se já tem resolução, retornar
    if (resource.width && resource.height) {
      return NextResponse.json({
        success: true,
        message: 'Recurso já possui metadados',
        metadata: {
          width: resource.width,
          height: resource.height
        }
      })
    }

    // Só processar vídeos
    if (resource.resource_type !== 'video') {
      return NextResponse.json({ error: 'Apenas vídeos podem ter metadados extraídos' }, { status: 400 })
    }

    if (!resource.file_url) {
      return NextResponse.json({ error: 'Recurso não possui arquivo' }, { status: 400 })
    }

    console.log('📊 Extracting metadata for resource:', params.id)

    // Baixar arquivo temporariamente
    const fileUrl = getS3Url(resource.file_url)
    const tempFilePath = join(tmpdir(), `video-${Date.now()}-${Math.random().toString(36)}.mp4`)

    try {
      console.log('📥 Downloading video from:', fileUrl.substring(0, 100))
      const response = await fetch(fileUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      console.log('💾 Saving to temp file:', tempFilePath)
      await writeFile(tempFilePath, buffer)

      // Extrair metadados
      console.log('🔍 Extracting metadata...')
      const metadata = await extractVideoMetadata(tempFilePath)

      if (!metadata) {
        throw new Error('Failed to extract metadata')
      }

      console.log('✅ Metadata extracted:', metadata)

      // Limpar arquivo temporário
      await unlink(tempFilePath).catch(() => {})

      // Atualizar banco de dados usando admin client para bypassar RLS
      const adminSupabase = createSupabaseAdmin()
      const updateData: any = {
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration ? Math.round(metadata.duration) : null,
        frame_rate: metadata.frameRate || null,
        has_alpha_channel: metadata.hasAlpha || false,
        has_loop: metadata.hasLoop || false,
        orientation: metadata.orientation || null,
      }
      
      // Usar codec se disponível
      if (metadata.codec) {
        updateData.video_encoding = metadata.codec
        updateData.video_codec = metadata.codec
      } else if (metadata.encoding) {
        updateData.video_encoding = metadata.encoding
      }
      
      if (metadata.colorSpace) updateData.video_color_space = metadata.colorSpace
      if (metadata.hasTimecode !== undefined) updateData.video_has_timecode = metadata.hasTimecode
      if (metadata.audioCodec) updateData.video_audio_codec = metadata.audioCodec
      
      const { error: updateError } = await adminSupabase
        .from('resources')
        .update(updateData)
        .eq('id', params.id)

      if (updateError) {
        console.error('❌ Error updating database:', updateError)
        throw updateError
      }

      return NextResponse.json({
        success: true,
        message: 'Metadados extraídos e salvos com sucesso',
        metadata
      })

    } catch (error: any) {
      // Limpar arquivo temporário em caso de erro
      await unlink(tempFilePath).catch(() => {})
      
      console.error('❌ Error extracting metadata:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao extrair metadados' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ Error in extract metadata:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}


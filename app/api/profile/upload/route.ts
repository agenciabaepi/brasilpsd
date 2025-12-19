import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3 } from '@/lib/aws/s3'
import { isSystemProfileSync } from '@/lib/utils/system'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'avatar' ou 'cover'
    const targetProfileId = formData.get('profileId') as string // ID do perfil a atualizar (opcional, padrão: usuário logado)

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!type || (type !== 'avatar' && type !== 'cover')) {
      return NextResponse.json({ error: 'Tipo inválido. Use "avatar" ou "cover"' }, { status: 400 })
    }

    // Determinar qual perfil atualizar
    let profileIdToUpdate = user.id
    if (targetProfileId && isSystemProfileSync(targetProfileId)) {
      // Verificar se o usuário é admin para atualizar perfil do sistema
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Apenas administradores podem atualizar o perfil do sistema' }, { status: 403 })
      }
      profileIdToUpdate = targetProfileId
    }

    // Validar tipo de arquivo (apenas imagens)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens são permitidas' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)

    // Otimizar e redimensionar imagem
    let optimizedBuffer: Buffer
    let contentType = 'image/webp'
    let width: number
    let height: number

    if (type === 'avatar') {
      // Avatar: 400x400px, circular, WebP
      optimizedBuffer = await sharp(buffer)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toBuffer()
      width = 400
      height = 400
    } else {
      // Cover: 1920x600px, WebP
      optimizedBuffer = await sharp(buffer)
        .resize(1920, 600, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toBuffer()
      width = 1920
      height = 600
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = 'webp'
    const key = `profiles/${profileIdToUpdate}/${type}-${timestamp}-${randomString}.${fileExtension}`

    // Upload para S3
    const fileUrl = await uploadFileToS3({
      file: optimizedBuffer,
      key,
      contentType,
      metadata: {
        userId: user.id,
        type: type,
        width: width.toString(),
        height: height.toString()
      }
    })

    // Atualizar perfil no banco
    const updateField = type === 'avatar' ? 'avatar_url' : 'cover_image'
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        [updateField]: fileUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileIdToUpdate)

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      type: type
    })
  } catch (error: any) {
    console.error('Erro no upload de perfil:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 500 }
    )
  }
}


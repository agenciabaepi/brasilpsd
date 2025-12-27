import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
 * API para servir áudios com autenticação obrigatória
 * 
 * Validações:
 * 1. Autenticação do usuário (obrigatória)
 * 2. Verificação se o recurso existe e está aprovado
 * 3. Geração de presigned URL temporária (1 hora)
 * 4. Redirecionamento para URL assinada
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTENTICAÇÃO (OPCIONAL - permitir reprodução pública)
    // ========================================================================
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // ========================================================================
    // 2. OBTER PARÂMETROS
    // ========================================================================
    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId')
    const key = searchParams.get('key')
    const type = searchParams.get('type') || 'file' // 'file' ou 'preview'
    
    // Permitir acesso sem autenticação para reprodução (streaming)
    // A autenticação só é necessária para downloads e recursos premium específicos

    if (!resourceId || !key) {
      return NextResponse.json(
        { 
          error: 'Parâmetros inválidos',
          message: 'Os parâmetros resourceId e key são obrigatórios.'
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // 3. VERIFICAR SE RECURSO EXISTE E ESTÁ APROVADO
    // ========================================================================
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, status, resource_type, is_premium, creator_id')
      .eq('id', resourceId)
      .single()

    if (resourceError || !resource) {
      console.warn('⚠️ Audio stream blocked: Resource not found', { resourceId })
      return NextResponse.json(
        { 
          error: 'Recurso não encontrado',
          message: 'O recurso solicitado não existe ou foi removido.'
        },
        { status: 404 }
      )
    }

    // Verificar se é um áudio
    if (resource.resource_type !== 'audio') {
      return NextResponse.json(
        { 
          error: 'Tipo de recurso inválido',
          message: 'Este endpoint é apenas para recursos de áudio.'
        },
        { status: 400 }
      )
    }

    // Verificar se recurso está aprovado OU se é o criador/admin
    let isCreator = false
    let isAdmin = false
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      isCreator = resource.creator_id === user.id
      isAdmin = profile?.is_admin || false
    }

    // Verificar se recurso está aprovado (para ambos preview e file)
    // Permitir acesso público para reprodução de recursos aprovados
    if (resource.status !== 'approved' && !isCreator && !isAdmin) {
      console.warn('⚠️ Audio stream blocked: Resource not approved', {
        userId: user?.id,
        resourceId,
        status: resource.status
      })
      
      return NextResponse.json(
        { 
          error: 'Recurso não disponível',
          message: 'Este recurso não está disponível para reprodução no momento.'
        },
        { status: 403 }
      )
    }

    // ========================================================================
    // 4. VERIFICAR ASSINATURA SE RECURSO FOR PREMIUM
    // ========================================================================
    // Para reprodução (streaming), permitir acesso mesmo sem assinatura
    // A verificação de assinatura só é necessária para downloads
    // Isso permite que usuários ouçam o áudio antes de se inscrever
    // (A verificação de assinatura para downloads é feita no endpoint /api/download)

    // ========================================================================
    // 5. GERAR PRESIGNED URL TEMPORÁRIA
    // ========================================================================
    try {
      // Validar key antes de tentar gerar URL
      if (!key || !key.trim()) {
        console.error('❌ Invalid key provided:', { resourceId, key })
        return NextResponse.json(
          { 
            error: 'Chave inválida',
            message: 'A chave do arquivo é inválida ou está vazia.'
          },
          { status: 400 }
        )
      }
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      // Gerar URL assinada válida por 1 hora
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      
      // Validar se a URL foi gerada corretamente
      if (!signedUrl || !signedUrl.trim()) {
        console.error('❌ Failed to generate signed URL:', { resourceId, key })
        return NextResponse.json(
          { 
            error: 'Erro ao gerar URL de acesso',
            message: 'Não foi possível gerar o link de acesso ao áudio.'
          },
          { status: 500 }
        )
      }

      // Retornar URL assinada diretamente (Wavesurfer precisa de URL direta)
      return NextResponse.json({
        url: signedUrl
      }, {
        headers: {
          'Cache-Control': 'private, max-age=3600',
        }
      })
    } catch (s3Error: any) {
      console.error('❌ Error generating signed URL:', {
        error: s3Error,
        message: s3Error?.message,
        code: s3Error?.Code,
        resourceId,
        key
      })
      
      // Verificar se é erro de arquivo não encontrado
      if (s3Error?.Code === 'NoSuchKey' || s3Error?.name === 'NoSuchKey') {
        return NextResponse.json(
          { 
            error: 'Arquivo não encontrado',
            message: 'O arquivo de áudio não foi encontrado no servidor.'
          },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Erro ao gerar URL de acesso',
          message: 'Não foi possível gerar o link de acesso ao áudio.'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ Audio stream error:', error)
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}


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
    // 1. AUTENTICAÇÃO OBRIGATÓRIA
    // ========================================================================
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.warn('⚠️ Audio stream blocked: Unauthorized')
      return NextResponse.json(
        { 
          error: 'Não autorizado',
          message: 'Você precisa fazer login para acessar este áudio.'
        },
        { status: 401 }
      )
    }

    // ========================================================================
    // 2. OBTER PARÂMETROS
    // ========================================================================
    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId')
    const key = searchParams.get('key')
    const type = searchParams.get('type') || 'file' // 'file' ou 'preview'

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
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isCreator = resource.creator_id === user.id
    const isAdmin = profile?.is_admin || false

    if (resource.status !== 'approved' && !isCreator && !isAdmin) {
      console.warn('⚠️ Audio stream blocked: Resource not approved', {
        userId: user.id,
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
    if (resource.is_premium && type === 'file') {
      // Buscar assinaturas ativas
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('id, tier, status, current_period_end')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      const now = new Date()
      const today = now.toISOString().split('T')[0]

      const hasActiveSubscription = subscriptions?.some(sub => {
        if (!sub.current_period_end) return false
        const periodEnd = typeof sub.current_period_end === 'string' 
          ? sub.current_period_end.split('T')[0]
          : new Date(sub.current_period_end).toISOString().split('T')[0]
        return periodEnd >= today
      })

      if (!hasActiveSubscription && !isCreator && !isAdmin) {
        console.warn('⚠️ Audio stream blocked: Premium resource without subscription', {
          userId: user.id,
          resourceId
        })
        
        return NextResponse.json(
          { 
            error: 'Assinatura necessária',
            message: 'Este áudio é exclusivo para membros Premium.'
          },
          { status: 403 }
        )
      }
    }

    // ========================================================================
    // 5. GERAR PRESIGNED URL TEMPORÁRIA
    // ========================================================================
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      // Gerar URL assinada válida por 1 hora
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

      // Redirecionar para a URL assinada
      return NextResponse.redirect(signedUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'private, max-age=3600',
        }
      })
    } catch (s3Error: any) {
      console.error('❌ Error generating signed URL:', s3Error)
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


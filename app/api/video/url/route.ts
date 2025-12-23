import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/aws/s3'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileUrl, resourceId } = await request.json()

    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing fileUrl' }, { status: 400 })
    }

    // Se resourceId for fornecido, verificar se o usuário tem acesso ao recurso
    if (resourceId) {
      const { data: resource } = await supabase
        .from('resources')
        .select('id, status, is_premium, creator_id')
        .eq('id', resourceId)
        .single()

      if (resource) {
        // Verificar se é premium e se o usuário tem acesso
        if (resource.is_premium) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium, is_admin')
            .eq('id', user.id)
            .single()

          if (!profile?.is_premium && !profile?.is_admin && resource.creator_id !== user.id) {
            return NextResponse.json({ error: 'Premium resource requires subscription' }, { status: 403 })
          }
        }

        // Verificar se o recurso está aprovado (a menos que seja o criador ou admin)
        if (resource.status !== 'approved') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()

          if (!profile?.is_admin && resource.creator_id !== user.id) {
            return NextResponse.json({ error: 'Resource not available' }, { status: 403 })
          }
        }
      }
    }

    // Extrair a key do S3 da URL
    let key = fileUrl
    
    // Se já é uma URL completa, extrair a key
    if (fileUrl.startsWith('http')) {
      if (fileUrl.includes('.s3.')) {
        // URL do S3: https://bucket.s3.region.amazonaws.com/key
        const match = fileUrl.match(/\.s3\.[^/]+\/(.+)$/)
        if (match) {
          key = decodeURIComponent(match[1])
        }
      } else if (fileUrl.includes('cloudfront.net')) {
        // URL do CloudFront: https://domain.cloudfront.net/key
        const match = fileUrl.match(/cloudfront\.net\/(.+)$/)
        if (match) {
          key = decodeURIComponent(match[1])
        }
      } else {
        // Tentar extrair de qualquer URL
        try {
          const url = new URL(fileUrl)
          key = url.pathname.substring(1) // Remove a barra inicial
        } catch (e) {
          console.error('Error parsing URL:', e)
        }
      }
    }
    
    // Se ainda não conseguiu extrair, usar como está (pode ser uma key direta)
    if (!key || key === fileUrl) {
      key = fileUrl
    }
    
    console.log('Extracted key from URL:', { original: fileUrl, extracted: key })

    console.log('Generating signed URL for key:', key)
    
    // Gerar signed URL (válida por 1 hora)
    const signedUrl = await getSignedDownloadUrl(key, 3600)
    
    console.log('Generated signed URL:', signedUrl.substring(0, 100) + '...')

    return NextResponse.json({ url: signedUrl })
  } catch (error: any) {
    console.error('Video URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate video URL' },
      { status: 500 }
    )
  }
}


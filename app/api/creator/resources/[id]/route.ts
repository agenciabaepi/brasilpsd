import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { deleteFileFromS3 } from '@/lib/aws/s3'

// Função auxiliar para extrair a key do S3 de uma URL
function extractS3Key(url: string): string | null {
  if (!url) {
    console.warn('extractS3Key: URL is empty or null')
    return null
  }
  
  console.log('extractS3Key: Processing URL:', url)
  
  // Se já é uma key (não começa com http), retornar como está
  if (!url.startsWith('http')) {
    console.log('extractS3Key: URL is already a key:', url)
    return url
  }
  
  try {
    // Tentar extrair de URL do S3 (formato: https://bucket.s3.region.amazonaws.com/key)
    if (url.includes('.s3.')) {
      const match = url.match(/\.s3\.[^/]+\/(.+)$/)
      if (match && match[1]) {
        const key = decodeURIComponent(match[1])
        console.log('extractS3Key: Extracted from S3 URL:', key)
        return key
      }
    }
    
    // Tentar extrair de URL do CloudFront (formato: https://domain.cloudfront.net/key)
    if (url.includes('cloudfront.net')) {
      const match = url.match(/cloudfront\.net\/(.+)$/)
      if (match && match[1]) {
        const key = decodeURIComponent(match[1])
        console.log('extractS3Key: Extracted from CloudFront URL:', key)
        return key
      }
    }
    
    // Tentar extrair de qualquer URL usando URL object
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // Remove a barra inicial se existir
    let key = pathname.startsWith('/') ? pathname.substring(1) : pathname
    
    if (key) {
      key = decodeURIComponent(key)
      console.log('extractS3Key: Extracted from pathname:', key)
      return key
    }
    
    console.warn('extractS3Key: Could not extract key from URL:', url)
  } catch (error: any) {
    console.error('extractS3Key: Error extracting S3 key from URL:', {
      url,
      error: error.message,
      stack: error.stack
    })
  }
  
  return null
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resourceId = params.id

    // Buscar o recurso para verificar se o usuário é o criador
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('file_url, thumbnail_url, preview_url, creator_id')
      .eq('id', resourceId)
      .single()

    if (resourceError || !resource) {
      console.error('Resource not found or error:', resourceError)
      return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 })
    }

    // Verificar se o usuário é o criador do recurso ou é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (resource.creator_id !== user.id && !profile?.is_admin) {
      return NextResponse.json({ 
        error: 'Acesso negado. Você só pode deletar seus próprios recursos.' 
      }, { status: 403 })
    }

    // Deletar arquivos do S3 ANTES de deletar do banco
    const deletedFiles: string[] = []
    const errors: string[] = []

    console.log('Starting S3 deletion process for creator...')
    console.log('Resource file_url:', resource.file_url)
    console.log('Resource thumbnail_url:', resource.thumbnail_url)
    console.log('Resource preview_url:', resource.preview_url)

    // Deletar arquivo principal
    if (resource.file_url) {
      const fileKey = extractS3Key(resource.file_url)
      console.log('Extracted file key:', fileKey, 'from URL:', resource.file_url)
      
      if (fileKey) {
        try {
          console.log('Attempting to delete main file from S3 with key:', fileKey)
          await deleteFileFromS3(fileKey)
          deletedFiles.push(`Arquivo principal: ${fileKey}`)
          console.log('✅ Successfully deleted main file from S3:', fileKey)
        } catch (error: any) {
          console.error('❌ Error deleting main file from S3:', {
            key: fileKey,
            error: error.message,
            code: error.Code || error.code,
            name: error.name
          })
          errors.push(`Erro ao deletar arquivo principal (${fileKey}): ${error.message || error.Code || 'Erro desconhecido'}`)
        }
      } else {
        console.warn('⚠️ Could not extract S3 key from file_url:', resource.file_url)
        errors.push(`Não foi possível extrair a key do arquivo principal. URL: ${resource.file_url}`)
      }
    } else {
      console.warn('⚠️ No file_url found in resource')
      errors.push('Recurso não possui file_url')
    }

    // Deletar thumbnail
    if (resource.thumbnail_url) {
      const thumbnailKey = extractS3Key(resource.thumbnail_url)
      console.log('Extracted thumbnail key:', thumbnailKey, 'from URL:', resource.thumbnail_url)
      
      if (thumbnailKey) {
        try {
          console.log('Attempting to delete thumbnail from S3 with key:', thumbnailKey)
          await deleteFileFromS3(thumbnailKey)
          deletedFiles.push(`Thumbnail: ${thumbnailKey}`)
          console.log('✅ Successfully deleted thumbnail from S3:', thumbnailKey)
        } catch (error: any) {
          console.error('❌ Error deleting thumbnail from S3:', {
            key: thumbnailKey,
            error: error.message,
            code: error.Code || error.code,
            name: error.name
          })
          errors.push(`Erro ao deletar thumbnail (${thumbnailKey}): ${error.message || error.Code || 'Erro desconhecido'}`)
        }
      } else {
        console.warn('⚠️ Could not extract S3 key from thumbnail_url:', resource.thumbnail_url)
        errors.push(`Não foi possível extrair a key do thumbnail. URL: ${resource.thumbnail_url}`)
      }
    } else {
      console.log('ℹ️ No thumbnail_url found in resource (this is OK)')
    }

    // Deletar preview (se existir)
    if (resource.preview_url) {
      const previewKey = extractS3Key(resource.preview_url)
      console.log('Extracted preview key:', previewKey, 'from URL:', resource.preview_url)
      
      if (previewKey) {
        try {
          console.log('Attempting to delete preview from S3 with key:', previewKey)
          await deleteFileFromS3(previewKey)
          deletedFiles.push(`Preview: ${previewKey}`)
          console.log('✅ Successfully deleted preview from S3:', previewKey)
        } catch (error: any) {
          console.error('❌ Error deleting preview from S3:', {
            key: previewKey,
            error: error.message,
            code: error.Code || error.code,
            name: error.name
          })
          errors.push(`Erro ao deletar preview (${previewKey}): ${error.message || error.Code || 'Erro desconhecido'}`)
        }
      } else {
        console.warn('⚠️ Could not extract S3 key from preview_url:', resource.preview_url)
        errors.push(`Não foi possível extrair a key do preview. URL: ${resource.preview_url}`)
      }
    } else {
      console.log('ℹ️ No preview_url found in resource (this is OK)')
    }

    // Deletar do banco de dados
    const { error: deleteError } = await supabase
      .from('resources')
      .delete()
      .eq('id', resourceId)

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return NextResponse.json(
        { 
          error: 'Erro ao deletar do banco de dados',
          details: deleteError.message,
          code: deleteError.code,
          s3Deleted: deletedFiles,
          s3Errors: errors
        },
        { status: 500 }
      )
    }

    console.log('Resource deleted from database:', resourceId)

    // Se houver erros críticos no S3, ainda retornar sucesso mas avisar
    const response: any = {
      success: true,
      message: 'Recurso deletado do banco de dados',
      deletedFiles,
    }

    if (errors.length > 0) {
      response.warnings = errors
      response.message = 'Recurso deletado do banco, mas alguns arquivos do S3 não foram removidos. Verifique os logs.'
    } else {
      response.message = 'Recurso deletado com sucesso (banco de dados e S3)'
    }

    console.log('Delete operation completed:', response)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Delete resource error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar recurso' },
      { status: 500 }
    )
  }
}


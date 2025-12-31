import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { deleteFileFromS3 } from '@/lib/aws/s3'

// Função auxiliar para extrair a key do S3 de uma URL
function extractS3Key(url: string): string | null {
  if (!url) return null
  
  if (!url.startsWith('http')) {
    return url
  }
  
  try {
    if (url.includes('.s3.')) {
      const match = url.match(/\.s3\.[^/]+\/(.+)$/)
      if (match && match[1]) {
        return decodeURIComponent(match[1])
      }
    }
    
    if (url.includes('cloudfront.net')) {
      const match = url.match(/cloudfront\.net\/(.+)$/)
      if (match && match[1]) {
        return decodeURIComponent(match[1])
      }
    }
    
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    let key = pathname.startsWith('/') ? pathname.substring(1) : pathname
    
    if (key) {
      return decodeURIComponent(key)
    }
  } catch (error: any) {
    console.error('Error extracting S3 key:', error)
  }
  
  return null
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ 
        error: 'Acesso negado. Apenas administradores podem deletar recursos.' 
      }, { status: 403 })
    }

    const { resourceIds } = await request.json()

    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json({ error: 'IDs de recursos são obrigatórios' }, { status: 400 })
    }

    // Usar admin client para bypassar RLS
    const adminSupabase = createSupabaseAdmin()

    // Buscar os recursos
    const { data: resources, error: resourceError } = await adminSupabase
      .from('resources')
      .select('id, file_url, thumbnail_url, preview_url')
      .in('id', resourceIds)

    if (resourceError || !resources || resources.length === 0) {
      return NextResponse.json({ error: 'Recursos não encontrados' }, { status: 404 })
    }

    const results = {
      deleted: [] as string[],
      failed: [] as { id: string, error: string }[],
      deletedFiles: [] as string[],
      errors: [] as string[]
    }

    // Processar cada recurso
    for (const resource of resources) {
      try {
        // Deletar arquivos do S3
        const filesToDelete = [
          { url: resource.file_url, type: 'Arquivo principal' },
          { url: resource.thumbnail_url, type: 'Thumbnail' },
          { url: resource.preview_url, type: 'Preview' }
        ]

        for (const file of filesToDelete) {
          if (file.url) {
            const fileKey = extractS3Key(file.url)
            if (fileKey) {
              try {
                await deleteFileFromS3(fileKey)
                results.deletedFiles.push(`${file.type}: ${fileKey}`)
              } catch (error: any) {
                console.error(`Error deleting ${file.type} for resource ${resource.id}:`, error)
                results.errors.push(`Erro ao deletar ${file.type} (${fileKey}): ${error.message || 'Erro desconhecido'}`)
              }
            }
          }
        }

        // Deletar do banco de dados usando admin client
        const { error: deleteError } = await adminSupabase
          .from('resources')
          .delete()
          .eq('id', resource.id)

        if (deleteError) {
          throw new Error(deleteError.message)
        }

        results.deleted.push(resource.id)
      } catch (error: any) {
        console.error(`Error deleting resource ${resource.id}:`, error)
        results.failed.push({
          id: resource.id,
          error: error.message || 'Erro desconhecido'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.deleted.length} recurso(s) deletado(s) com sucesso`,
      deleted: results.deleted,
      failed: results.failed,
      deletedFiles: results.deletedFiles,
      warnings: results.errors.length > 0 ? results.errors : undefined
    })
  } catch (error: any) {
    console.error('Bulk delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar recursos' },
      { status: 500 }
    )
  }
}


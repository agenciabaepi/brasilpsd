import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/aws/s3'
import archiver from 'archiver'
import { Readable } from 'stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minuto para criar o ZIP

/**
 * API para download de família completa de fontes
 * Cria um ZIP com todas as variações da família
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado', message: 'Você precisa fazer login para baixar recursos.' },
        { status: 401 }
      )
    }

    const { resourceId } = await request.json()

    if (!resourceId) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', message: 'resourceId é obrigatório.' },
        { status: 400 }
      )
    }

    // 1. Buscar a fonte principal
    const { data: mainResource, error: mainError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .eq('status', 'approved')
      .eq('resource_type', 'font')
      .single()

    if (mainError || !mainResource) {
      return NextResponse.json(
        { error: 'Fonte não encontrada', message: 'A fonte solicitada não foi encontrada ou não está aprovada.' },
        { status: 404 }
      )
    }

    // 2. Determinar o ID da família
    const familyId = mainResource.font_family_id || mainResource.id

    // 3. Buscar todas as fontes da família
    const { data: familyResources, error: familyError } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .eq('resource_type', 'font')
      .or(`id.eq.${familyId},font_family_id.eq.${familyId}`)
      .order('font_weight')
      .order('font_style')

    if (familyError || !familyResources || familyResources.length === 0) {
      return NextResponse.json(
        { error: 'Família não encontrada', message: 'Nenhuma fonte da família foi encontrada.' },
        { status: 404 }
      )
    }

    // Se houver apenas uma fonte, redirecionar para download normal
    if (familyResources.length === 1) {
      return NextResponse.json(
        { error: 'Família única', message: 'Esta fonte não possui variações. Use o download individual.' },
        { status: 400 }
      )
    }

    // 4. Criar ZIP com todas as fontes
    const archive = archiver('zip', {
      zlib: { level: 9 } // Máxima compressão
    })

    // Stream para armazenar o ZIP
    const chunks: Buffer[] = []
    
    // Promessa para aguardar finalização
    const archivePromise = new Promise<void>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      archive.on('end', () => resolve())
      archive.on('error', (err) => reject(err))
    })

    // 5. Baixar cada fonte do S3 e adicionar ao ZIP
    for (const resource of familyResources) {
      try {
        // Obter URL assinada do S3
        const signedUrl = await getSignedDownloadUrl(resource.file_url, 300) // 5 minutos
        
        // Baixar o arquivo
        const response = await fetch(signedUrl)
        if (!response.ok) {
          console.error(`Erro ao baixar ${resource.title}:`, response.statusText)
          continue
        }

        const fileBuffer = Buffer.from(await response.arrayBuffer())
        
        // Nome do arquivo no ZIP (usar título da fonte + extensão)
        const fileExtension = resource.file_format || 'ttf'
        const fileName = `${resource.title.replace(/[^a-z0-9]/gi, '_')}.${fileExtension}`
        
        archive.append(fileBuffer, { name: fileName })
      } catch (error) {
        console.error(`Erro ao processar ${resource.title}:`, error)
        // Continuar com as outras fontes mesmo se uma falhar
      }
    }

    // 6. Finalizar o ZIP e aguardar
    archive.finalize()
    await archivePromise

    // 8. Combinar todos os chunks em um único buffer
    const zipBuffer = Buffer.concat(chunks)

    // 9. Nome do arquivo ZIP (usar nome da família)
    const familyName = mainResource.title.replace(/[^a-z0-9]/gi, '_')
    const zipFileName = `${familyName}_Family.zip`

    // 10. Registrar downloads para todas as fontes
    const downloadRecords = familyResources.map(resource => ({
      user_id: user.id,
      resource_id: resource.id,
      downloaded_at: new Date().toISOString()
    }))

    // Inserir registros de download (pode falhar silenciosamente se já existir)
    await supabase
      .from('downloads')
      .upsert(downloadRecords, { onConflict: 'user_id,resource_id' })
      .catch(err => console.error('Erro ao registrar downloads:', err))

    // 11. Incrementar contadores de download
    for (const resource of familyResources) {
      await supabase.rpc('increment', {
        table_name: 'resources',
        column_name: 'download_count',
        row_id: resource.id
      }).catch(err => console.error(`Erro ao incrementar download de ${resource.id}:`, err))
    }

    // 12. Retornar o ZIP
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Erro ao criar ZIP da família:', error)
    return NextResponse.json(
      { error: 'Erro ao criar arquivo ZIP', message: error.message || 'Erro desconhecido' },
      { status: 500 }
    )
  }
}


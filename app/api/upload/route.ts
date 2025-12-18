import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { uploadFileToS3 } from '@/lib/aws/s3'
import sharp from 'sharp'
import AdmZip from 'adm-zip'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is creator
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile || (!profile.is_creator && !profile.is_admin)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'resource' or 'thumbnail'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)
    let contentType = file.type
    let fileExtension = file.name.split('.').pop()?.toLowerCase()

    // 0. DETECÇÃO AUTOMÁTICA DE IA (Apenas para imagens)
    let isAiGenerated = false
    if (file.type.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer).metadata()
        const metadataString = JSON.stringify(metadata).toLowerCase()
        
        // Marcadores comuns de ferramentas de IA
        const aiMarkers = [
          'midjourney',
          'dall-e',
          'stablediffusion',
          'adobe firefly',
          'trainedalgorithmicmedia', // Tag oficial IPTC para IA
          'generative fill',
          'artificial intelligence',
          'ai generated',
          'fotor',
          'canva ai'
        ]
        
        isAiGenerated = aiMarkers.some(marker => metadataString.includes(marker))
        
        // Verificação extra em tags específicas do XMP
        if (metadata.xmp) {
          const xmpString = metadata.xmp.toString().toLowerCase()
          if (xmpString.includes('digitalsourcetype') && xmpString.includes('trainedalgorithmicmedia')) {
            isAiGenerated = true
          }
        }
      } catch (err) {
        console.warn('Falha ao analisar metadados de IA:', err)
      }
    }

    // 1. OTIMIZAÇÃO DE IMAGEM E MARCA D'ÁGUA (Apenas para thumbnails)
    if (type === 'thumbnail') {
      // Criar a Marca D'água (Padrão repetido estilo Stock)
      const watermarkSvg = Buffer.from(`
        <svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="watermark-pattern" x="0" y="0" width="300" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
              <g opacity="0.15">
                <text 
                  x="50%" 
                  y="50%" 
                  font-family="sans-serif" 
                  font-weight="900" 
                  font-size="24" 
                  fill="white" 
                  text-anchor="middle"
                  letter-spacing="2"
                >
                  BRASILPSD
                </text>
                <text 
                  x="50.5%" 
                  y="50.5%" 
                  font-family="sans-serif" 
                  font-weight="900" 
                  font-size="24" 
                  fill="black" 
                  opacity="0.2"
                  text-anchor="middle"
                  letter-spacing="2"
                >
                  BRASILPSD
                </text>
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
        </svg>
      `)

      const pipeline = sharp(buffer)
      
      pipeline
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .composite([
          { 
            input: watermarkSvg, 
            gravity: 'center',
            blend: 'over' 
          }
        ])
        .webp({ quality: 85 })
      
      buffer = await pipeline.toBuffer()
      contentType = 'image/webp'
      fileExtension = 'webp'
    }

    // 2. COMPACTAÇÃO EM ZIP (Para o recurso principal)
    if (type === 'resource' && fileExtension !== 'zip') {
      const zip = new AdmZip()
      
      // Adiciona o arquivo original ao ZIP
      zip.addFile(file.name, buffer)
      
      // Adiciona um arquivo de licença padrão (Opcional, mas profissional)
      const licenseText = `
BRASIL PSD - LICENÇA DE USO
---------------------------
Este arquivo foi baixado em BrasilPSD.com.br.

Ao baixar este recurso, você concorda que:
1. Pode ser usado para projetos pessoais e comerciais.
2. Não é permitida a redistribuição ou venda do arquivo fonte original.
3. A BrasilPSD não se responsabiliza por problemas técnicos após a edição.

Obrigado por usar nossa plataforma!
      `
      zip.addFile('LICENSE.txt', Buffer.from(licenseText, 'utf8'))
      
      buffer = zip.toBuffer()
      contentType = 'application/zip'
      fileExtension = 'zip'
    }

    // Generate file key
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`
    const fileKey = type === 'thumbnail' 
      ? `thumbnails/${user.id}/${fileName}`
      : `resources/${user.id}/${fileName}`

    // Upload to S3
    const fileUrl = await uploadFileToS3({
      file: buffer,
      key: fileKey,
      contentType: contentType,
      metadata: {
        userId: user.id,
        originalName: file.name,
        optimized: 'true',
        isZip: type === 'resource' ? 'true' : 'false',
        isAiGenerated: isAiGenerated.toString()
      },
    })

    return NextResponse.json({ url: fileUrl, key: fileKey, isAiGenerated })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao enviar arquivo' },
      { status: 500 }
    )
  }
}

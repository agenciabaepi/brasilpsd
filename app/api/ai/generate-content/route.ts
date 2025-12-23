import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Gera título e descrição usando ChatGPT a partir dos metadados da imagem
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { metadata, fileName, categories, imageBase64 } = await request.json()

    // Se temos imagem visual, não usar fileName para evitar que a IA copie o nome do arquivo
    const shouldIgnoreFileName = !!imageBase64

    console.log('📸 AI Generate Content Request:', {
      fileName: shouldIgnoreFileName ? 'IGNORADO (usando análise visual)' : (fileName || 'não fornecido'),
      hasImageBase64: !!imageBase64,
      imageBase64Length: imageBase64?.length || 0,
      categoriesCount: categories?.length || 0,
      willIgnoreFileName: shouldIgnoreFileName
    })

    if (!metadata) {
      return NextResponse.json({ error: 'Metadados são obrigatórios' }, { status: 400 })
    }

    // Buscar categorias se não foram fornecidas
    let categoriesList = categories
    if (!categoriesList || categoriesList.length === 0) {
      // Se não foram fornecidas, buscar apenas categorias de imagens
      const { data: imagensCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'imagens')
        .is('parent_id', null)
        .maybeSingle()
      
      if (imagensCategory) {
        const { data: mainCat } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('id', imagensCategory.id)
          .single()
        
        const { data: subCats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .eq('parent_id', imagensCategory.id)
          .order('order_index', { ascending: true })
        
        categoriesList = [
          ...(mainCat ? [mainCat] : []),
          ...(subCats || [])
        ]
      } else {
        // Fallback: buscar todas
        const { data: cats } = await supabase
          .from('categories')
          .select('id, name, parent_id, slug')
          .order('name')
        categoriesList = cats || []
      }
    }
    
    // Garantir que todas as categorias tenham slug
    categoriesList = categoriesList.map((cat: any) => ({
      ...cat,
      slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')
    }))

    // Usar API key da variável de ambiente (configurada no .env.local)
    const apiKey = process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY

    console.log('🔑 API Key check:', {
      hasChatGPTKey: !!process.env.CHATGPT_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasApiKey: !!apiKey,
      keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none'
    })

    if (!apiKey) {
      console.error('❌ API key não encontrada! Verifique .env.local')
      return NextResponse.json({ 
        error: 'API key do ChatGPT não configurada',
        title: extractTitleFromFileName(fileName),
        description: '',
        category_ids: []
      }, { status: 200 }) // Retornar 200 mas sem tradução
    }

    // Preparar prompt com metadados (sem incluir fileName quando temos imagem visual)
    const metadataInfo = []
    if (metadata.width && metadata.height) {
      metadataInfo.push(`Resolução: ${metadata.width} × ${metadata.height} pixels`)
    }
    if (metadata.format) {
      metadataInfo.push(`Formato: ${metadata.format.toUpperCase()}`)
    }
    
    // Quando temos imagem visual, não incluir informações que possam levar a IA a usar o nome do arquivo
    if (shouldIgnoreFileName) {
      console.log('🚫 Ignorando nome do arquivo - usando apenas análise visual')
    } else {
      // Só incluir fileSize se não tivermos imagem visual (fallback)
      if (metadata.fileSize) {
        const sizeMB = (metadata.fileSize / (1024 * 1024)).toFixed(2)
        metadataInfo.push(`Tamanho: ${sizeMB} MB`)
      }
    }
    
    if (metadata.camera) {
      metadataInfo.push(`Câmera: ${metadata.camera}`)
    }
    if (metadata.location) {
      metadataInfo.push(`Local: ${metadata.location}`)
    }
    if (metadata.date) {
      metadataInfo.push(`Data: ${metadata.date}`)
    }

    const metadataText = shouldIgnoreFileName
      ? (metadataInfo.length > 0 ? metadataInfo.join('\n') : 'Analise apenas o conteúdo visual da imagem')
      : (metadataInfo.length > 0 ? metadataInfo.join('\n') : 'Metadados limitados disponíveis')

    // Preparar lista de categorias para o prompt (apenas categorias principais e subcategorias)
    const mainCategories = categoriesList.filter((cat: any) => !cat.parent_id)
    const subCategories = categoriesList.filter((cat: any) => cat.parent_id)
    
    const categoriesText = [
      ...mainCategories.map((cat: any) => `- ${cat.name} (ID: ${cat.id})`),
      ...subCategories.map((cat: any) => `  └─ ${cat.name} (ID: ${cat.id})`)
    ].join('\n')
    
    console.log('📋 Categories for AI:', {
      total: categoriesList.length,
      main: mainCategories.length,
      sub: subCategories.length,
      mainNames: mainCategories.map((c: any) => c.name)
    })

    // Preparar mensagens para a API
    const messages: any[] = [
      {
        role: 'system',
        content: 'Você é um especialista em criar títulos e descrições profissionais para imagens de stock e categorizar imagens adequadamente. Sempre responda em português brasileiro. Você DEVE responder APENAS com um objeto JSON válido, sem markdown, sem texto adicional. Use o formato JSON especificado nas instruções.'
      }
    ]

    // Se tiver imagem em base64, usar API de visão
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `🚨 REGRA ABSOLUTA: IGNORE COMPLETAMENTE O NOME DO ARQUIVO. O nome do arquivo é irrelevante e NÃO deve ser usado de forma alguma.

Você está analisando uma IMAGEM. Olhe para a imagem e descreva APENAS o que você REALMENTE VÊ visualmente.

❌ NÃO FAÇA:
- Usar o nome do arquivo no título
- Incluir números, datas ou códigos do nome do arquivo
- Copiar qualquer parte do nome do arquivo

✅ FAÇA:
- Analise APENAS o conteúdo visual da imagem
- Descreva o que você vê: pessoas, objetos, cenários, ações, emoções
- Use português brasileiro natural e descritivo

INSTRUÇÕES:
1. Olhe atentamente para a imagem e descreva EXATAMENTE o que você vê (pessoas, objetos, cenário, ação, emoção)
2. Gere um título curto e descritivo (máximo 60 caracteres) em português brasileiro baseado APENAS no que você vê na imagem
3. Crie uma descrição detalhada (2-3 frases) em português brasileiro
4. Extraia 3-5 palavras-chave relevantes
5. Escolha TODAS as categorias apropriadas baseadas no conteúdo visual

EXEMPLOS CORRETOS:
- Se você vê uma mulher de cabelos longos com as mãos juntas em oração: "Mulher em Oração" ou "Mulher Rezando"
- Se você vê uma paisagem de montanha ao pôr do sol: "Paisagem Montanhosa ao Pôr do Sol"
- Se você vê pessoas trabalhando em escritório: "Equipe Trabalhando em Escritório"

EXEMPLOS INCORRETOS (NÃO FAÇA):
- "Woman Praying 2022 05 12" ❌ (usou nome do arquivo)
- "Imagem 12345" ❌ (usou números do arquivo)
- Qualquer coisa que venha do nome do arquivo ❌

Categorias disponíveis:
${categoriesText}

IMPORTANTE SOBRE CATEGORIAS:
- Você DEVE escolher pelo menos 1 categoria
- Use APENAS os IDs que estão na lista acima
- Uma imagem pode pertencer a múltiplas categorias (ex: "Pessoas" E "Religiosidade")

Responda APENAS com JSON válido (sem markdown, sem código, apenas JSON puro):
{
  "title": "título baseado APENAS no que você vê na imagem",
  "description": "descrição detalhada do conteúdo visual",
  "keywords": ["palavra1", "palavra2", "palavra3"],
  "category_ids": ["id-da-categoria1", "id-da-categoria2"]
}`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      })
    } else {
      // Fallback: usar apenas metadados se não tiver imagem
      messages.push({
        role: 'user',
        content: `Com base no nome do arquivo e nas informações técnicas disponíveis, gere:
1. Um título curto, descritivo e profissional (máximo 60 caracteres) em português brasileiro
2. Uma descrição detalhada e atrativa (2-3 frases) em português brasileiro
3. Palavras-chave relevantes (3-5 palavras)
4. A categoria mais apropriada (use APENAS o ID da categoria da lista acima)

Nome do arquivo: ${fileName || 'desconhecido'}

Informações técnicas:
${metadataText}

Categorias disponíveis:
${categoriesText}

Responda APENAS no formato JSON válido:
{
  "title": "título aqui",
  "description": "descrição aqui",
  "keywords": ["palavra1", "palavra2", "palavra3"],
  "category_id": "uuid-da-categoria-aqui"
}`
      })
    }

    // Usar GPT-4o para visão (melhor qualidade), senão usar gpt-4o-mini
    const model = imageBase64 ? 'gpt-4o' : 'gpt-4o-mini'

    console.log('🤖 Sending to ChatGPT:', {
      model,
      hasImage: !!imageBase64,
      messagesCount: messages.length
    })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000, // Aumentar para garantir resposta completa
        response_format: { type: "json_object" } // Forçar formato JSON
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('❌ ChatGPT API error:', error)
      
      // Fallback: gerar título do nome do arquivo
      return NextResponse.json({
        title: extractTitleFromFileName(fileName),
        description: generateDescriptionFromMetadata(metadata),
        keywords: [],
        category_id: null
      })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    console.log('✅ ChatGPT Response:', {
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 200) || 'No content'
    })

    if (content) {
      try {
        // Limpar o conteúdo (remover markdown code blocks se houver)
        let cleanedContent = content.trim()
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/```\n?/g, '').trim()
        }
        
        // Tentar extrair JSON da resposta
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          
          console.log('📋 Parsed AI Response:', {
            title: parsed.title,
            hasDescription: !!parsed.description,
            keywordsCount: parsed.keywords?.length || 0,
            categoryIds: parsed.category_ids,
            categoryId: parsed.category_id
          })
          
          // Validar se as categorias sugeridas existem
          let categoryIds: string[] = []
          
          // Suportar tanto category_ids (array) quanto category_id (único) para compatibilidade
          if (parsed.category_ids && Array.isArray(parsed.category_ids) && parsed.category_ids.length > 0) {
            // Filtrar apenas IDs válidos
            categoryIds = parsed.category_ids.filter((catId: string) => {
              const exists = categoriesList.some((cat: any) => cat.id === catId)
              if (!exists) {
                console.warn(`⚠️ Category ID not found: ${catId}`)
              }
              return exists
            })
          } else if (parsed.category_id) {
            const categoryExists = categoriesList.some((cat: any) => cat.id === parsed.category_id)
            if (categoryExists) {
              categoryIds = [parsed.category_id]
            } else {
              console.warn(`⚠️ Category ID not found: ${parsed.category_id}`)
            }
          }
          
          // Se não encontrou categorias válidas, tentar encontrar por nome
          if (categoryIds.length === 0) {
            console.log('🔍 Trying to find categories by name...')
            // Procurar por palavras-chave no título/descrição
            const titleLower = (parsed.title || '').toLowerCase()
            const descLower = (parsed.description || '').toLowerCase()
            
            // Mapear palavras-chave para categorias
            const categoryKeywords: Record<string, string[]> = {
              'pessoa': ['pessoas'],
              'natureza': ['natureza'],
              'negócio': ['negocios', 'negócios'],
              'tecnologia': ['tecnologia'],
              'comida': ['comida-bebida', 'comida & bebida'],
              'viagem': ['viagem-turismo', 'viagem & turismo'],
              'esporte': ['esportes-fitness', 'esportes & fitness'],
              'arquitetura': ['arquitetura-interiores', 'arquitetura & interiores'],
              'abstrato': ['abstrato-artistico', 'abstrato & artístico'],
              'religioso': ['religiosidade']
            }
            
            // Tentar encontrar categoria por palavras-chave
            for (const [keyword, slugs] of Object.entries(categoryKeywords)) {
              if (titleLower.includes(keyword) || descLower.includes(keyword)) {
                const found = categoriesList.find((cat: any) => 
                  slugs.some((slug: string) => cat.slug === slug || cat.name.toLowerCase().includes(keyword))
                )
                if (found) {
                  categoryIds.push(found.id)
                  console.log(`✅ Found category by keyword "${keyword}": ${found.name}`)
                }
              }
            }
          }
          
          if (categoryIds.length > 0) {
            console.log('✅ Categories validated:', categoryIds)
          } else {
            console.warn('⚠️ No valid categories found, will return empty array')
          }
          
          return NextResponse.json({
            title: parsed.title || extractTitleFromFileName(fileName),
            description: parsed.description || generateDescriptionFromMetadata(metadata),
            keywords: parsed.keywords || [],
            category_ids: categoryIds,
            category_id: categoryIds.length > 0 ? categoryIds[0] : null // Primeira categoria para compatibilidade
          })
        } else {
          console.warn('⚠️ No JSON found in response')
          console.warn('Response content:', content.substring(0, 500))
        }
      } catch (parseError: any) {
        console.error('❌ Failed to parse ChatGPT response as JSON:', parseError)
        console.error('Response content:', content.substring(0, 500))
        console.error('Parse error details:', parseError.message)
      }
    }

    // Fallback
    return NextResponse.json({
      title: extractTitleFromFileName(fileName),
      description: generateDescriptionFromMetadata(metadata),
      keywords: [],
      category_id: null
    })

  } catch (error: any) {
    console.error('AI generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar conteúdo' },
      { status: 500 }
    )
  }
}

function extractTitleFromFileName(fileName: string): string {
  if (!fileName) return 'Imagem sem título'
  
  // Remover extensão
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
  
  // Remover caracteres especiais e substituir por espaços
  const cleaned = nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
  
  // Capitalizar primeira letra de cada palavra
  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .substring(0, 60)
}

function generateDescriptionFromMetadata(metadata: any): string {
  const parts: string[] = []
  
  if (metadata.width && metadata.height) {
    parts.push(`Imagem de alta qualidade com resolução ${metadata.width} × ${metadata.height} pixels`)
  }
  
  if (metadata.format) {
    parts.push(`Formato ${metadata.format.toUpperCase()}`)
  }
  
  return parts.join('. ') || 'Imagem de alta qualidade para uso profissional'
}


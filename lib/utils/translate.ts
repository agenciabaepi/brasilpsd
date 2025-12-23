/**
 * Traduz texto de inglês para português usando ChatGPT API
 */
export async function translateToPortuguese(text: string, apiKey?: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text
  }

  // Usar API key da variável de ambiente (configurada no .env.local)
  const finalApiKey = apiKey || process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY

  if (!finalApiKey) {
    console.warn('⚠️ ChatGPT API key not provided, skipping translation')
    return text
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um tradutor profissional. Traduza o texto fornecido do inglês para português brasileiro, mantendo o tom e contexto original. Se o texto já estiver em português, retorne-o sem alterações.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Translation API error:', error)
      return text // Retornar original se falhar
    }

    const data = await response.json()
    const translated = data.choices?.[0]?.message?.content?.trim()

    if (translated) {
      return translated
    }

    return text
  } catch (error: any) {
    console.error('Translation error:', error)
    return text // Retornar original se falhar
  }
}

/**
 * Detecta se o texto está em inglês
 */
export function isEnglish(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false
  }

  // Palavras comuns em inglês
  const englishWords = ['the', 'and', 'is', 'are', 'was', 'were', 'this', 'that', 'with', 'from', 'for', 'have', 'has', 'been', 'will', 'would', 'could', 'should']
  const textLower = text.toLowerCase()
  
  // Contar palavras em inglês
  const englishCount = englishWords.filter(word => textLower.includes(word)).length
  const totalWords = text.split(/\s+/).length
  
  // Se mais de 30% das palavras comuns são em inglês, considerar inglês
  return englishCount > 0 && (englishCount / Math.min(totalWords, 20)) > 0.3
}


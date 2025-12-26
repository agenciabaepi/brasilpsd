/**
 * Rate Limiting Utility
 * 
 * Previne abuso da API limitando requisições por IP
 * 
 * IMPORTANTE: Em produção, considere usar Redis ou outro sistema distribuído
 * para rate limiting em múltiplas instâncias do servidor.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Cache em memória (Map)
// Em produção, use Redis ou similar para múltiplas instâncias
const rateLimitStore = new Map<string, RateLimitEntry>()

// Limpar entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Limpar a cada minuto

export interface RateLimitOptions {
  maxRequests: number // Número máximo de requisições
  windowMs: number // Janela de tempo em milissegundos
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number // Segundos até poder tentar novamente
}

/**
 * Verifica se uma requisição deve ser permitida baseado no rate limit
 * 
 * @param identifier - Identificador único (IP, userId, etc)
 * @param options - Opções de rate limiting
 * @returns Resultado da verificação
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Se não existe entrada ou expirou, criar nova
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + options.windowMs
    }
    rateLimitStore.set(identifier, newEntry)
    
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime: newEntry.resetTime
    }
  }

  // Se já atingiu o limite
  if (entry.count >= options.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter
    }
  }

  // Incrementar contador
  entry.count++
  rateLimitStore.set(identifier, entry)

  return {
    allowed: true,
    remaining: options.maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Obtém o IP do cliente da requisição
 */
export function getClientIP(request: Request): string {
  // Tentar obter IP de headers comuns de proxy/load balancer
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Pegar o primeiro IP (cliente original)
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }

  // Fallback (não confiável em produção)
  return 'unknown'
}

/**
 * Rate limit padrão para API de downloads
 * - 20 requisições por minuto por IP
 * - 100 requisições por hora por IP
 */
export const DOWNLOAD_RATE_LIMITS = {
  perMinute: {
    maxRequests: 20,
    windowMs: 60 * 1000 // 1 minuto
  },
  perHour: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000 // 1 hora
  }
}

/**
 * Verifica rate limit para downloads
 */
export function checkDownloadRateLimit(ip: string): RateLimitResult {
  // Verificar limite por minuto
  const minuteCheck = checkRateLimit(`${ip}:minute`, DOWNLOAD_RATE_LIMITS.perMinute)
  if (!minuteCheck.allowed) {
    return {
      ...minuteCheck,
      retryAfter: minuteCheck.retryAfter
    }
  }

  // Verificar limite por hora
  const hourCheck = checkRateLimit(`${ip}:hour`, DOWNLOAD_RATE_LIMITS.perHour)
  if (!hourCheck.allowed) {
    return {
      ...hourCheck,
      retryAfter: hourCheck.retryAfter
    }
  }

  // Ambos permitidos, retornar o mais restritivo (menor remaining)
  return {
    allowed: true,
    remaining: Math.min(minuteCheck.remaining, hourCheck.remaining),
    resetTime: Math.min(minuteCheck.resetTime, hourCheck.resetTime)
  }
}


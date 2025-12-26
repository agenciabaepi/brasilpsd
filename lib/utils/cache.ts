/**
 * Cache Utility
 * 
 * Cache simples em memória com TTL (Time To Live)
 * 
 * IMPORTANTE: Em produção com múltiplas instâncias, use Redis ou similar
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// Cache em memória
const cacheStore = new Map<string, CacheEntry<any>>()

// Limpar entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt < now) {
      cacheStore.delete(key)
    }
  }
}, 60000) // Limpar a cada minuto

/**
 * Armazena um valor no cache
 * 
 * @param key - Chave única
 * @param data - Dados para armazenar
 * @param ttlMs - Tempo de vida em milissegundos
 */
export function setCache<T>(key: string, data: T, ttlMs: number = 30000): void {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs
  }
  cacheStore.set(key, entry)
}

/**
 * Obtém um valor do cache
 * 
 * @param key - Chave única
 * @returns Dados armazenados ou null se não existir/expirado
 */
export function getCache<T>(key: string): T | null {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined
  
  if (!entry) {
    return null
  }

  // Verificar se expirou
  if (entry.expiresAt < Date.now()) {
    cacheStore.delete(key)
    return null
  }

  return entry.data
}

/**
 * Remove um valor do cache
 */
export function deleteCache(key: string): void {
  cacheStore.delete(key)
}

/**
 * Remove todos os valores do cache que começam com o prefixo
 */
export function deleteCacheByPrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key)
    }
  }
}

/**
 * Limpa todo o cache
 */
export function clearCache(): void {
  cacheStore.clear()
}

/**
 * Gera chave de cache para status de downloads do usuário
 */
export function getDownloadStatusCacheKey(userId: string): string {
  return `download_status:${userId}`
}

/**
 * Gera chave de cache para limite de downloads do usuário
 */
export function getDownloadLimitCacheKey(userId: string): string {
  return `download_limit:${userId}`
}

/**
 * TTL padrão para cache de status de downloads (30 segundos)
 * Balanceia performance com atualização em tempo quase real
 */
export const DOWNLOAD_STATUS_CACHE_TTL = 30 * 1000 // 30 segundos


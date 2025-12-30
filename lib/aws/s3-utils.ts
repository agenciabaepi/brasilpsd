// Extrai a key do S3 de uma URL (http ou caminho relativo)
export function extractS3Key(url: string | null | undefined): string | null {
  if (!url) return null
  // Se já for uma key (não começa com http)
  if (!url.startsWith('http')) return url.replace(/^\/+/, '')

  try {
    const u = new URL(url)
    // Formatos comuns:
    // https://bucket.s3.region.amazonaws.com/key
    // https://bucket.s3.amazonaws.com/key
    // https://domain.cloudfront.net/key
    // https://bucket.s3.region.amazonaws.com/key?X-Amz-...
    const pathname = u.pathname || ''
    const key = pathname.replace(/^\/+/, '')
    return key || null
  } catch {
    return null
  }
}


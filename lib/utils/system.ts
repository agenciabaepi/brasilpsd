// Email do perfil oficial do sistema BrasilPSD
const SYSTEM_PROFILE_EMAIL = 'sistema@brasilpsd.com.br'

// UUID do perfil do sistema (criado manualmente no Supabase Auth)
const SYSTEM_PROFILE_ID = '4fcdbfce-ea01-4a86-ad02-ec24dc6f3758'

// Cache do UUID do sistema (será preenchido na primeira busca)
let cachedSystemProfileId: string | null = SYSTEM_PROFILE_ID

// Verifica se um ID é o perfil do sistema
export async function isSystemProfile(id: string | null | undefined): Promise<boolean> {
  if (!id) return false
  const systemId = await getSystemProfileId()
  return id === systemId
}

// Versão síncrona para compatibilidade (usa o cache)
export function isSystemProfileSync(id: string | null | undefined): boolean {
  if (!id || !cachedSystemProfileId) return false
  return id === cachedSystemProfileId
}

// Obtém o ID do perfil do sistema (busca pelo email)
export async function getSystemProfileId(): Promise<string> {
  // Se já temos o UUID em cache, retorna
  if (cachedSystemProfileId) {
    return cachedSystemProfileId
  }

  // Busca o UUID pelo email no banco
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Variáveis de ambiente do Supabase não configuradas. Usando UUID do sistema.')
      cachedSystemProfileId = SYSTEM_PROFILE_ID
      return cachedSystemProfileId
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Busca o perfil pelo email (ou usa o UUID direto se já estiver em cache)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', SYSTEM_PROFILE_EMAIL)
      .single()

    if (error || !profile) {
      console.warn('Perfil do sistema não encontrado pelo email. Usando UUID do sistema.')
      cachedSystemProfileId = SYSTEM_PROFILE_ID
      return cachedSystemProfileId
    }

    if (!profile?.id) {
      console.warn('Perfil do sistema não encontrado pelo email. Usando UUID do sistema.')
      cachedSystemProfileId = SYSTEM_PROFILE_ID
      return SYSTEM_PROFILE_ID
    }

    cachedSystemProfileId = profile.id
    return profile.id
  } catch (error) {
    console.error('Erro ao buscar UUID do sistema:', error)
    // Fallback para UUID do sistema
    cachedSystemProfileId = SYSTEM_PROFILE_ID
    return cachedSystemProfileId
  }
}

// Versão síncrona que retorna o UUID do sistema diretamente
export function getSystemProfileIdSync(): string {
  return SYSTEM_PROFILE_ID
}


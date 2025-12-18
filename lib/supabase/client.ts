import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const createSupabaseClient = () => {
  // Verificar se as variáveis de ambiente estão configuradas
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'Variáveis de ambiente do Supabase não configuradas!\n\n' +
      'Por favor, crie um arquivo .env.local na raiz do projeto com:\n' +
      'NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key\n\n' +
      'Você pode copiar o arquivo env.example para .env.local como base.'
    )
  }
  
  return createClientComponentClient()
}

export const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}


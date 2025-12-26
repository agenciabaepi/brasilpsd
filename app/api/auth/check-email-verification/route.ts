import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Verifica se um email foi verificado
 * Verifica na tabela email_verification_codes se existe algum código verificado
 * POST /api/auth/check-email-verification
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email não informado' }, { status: 400 })
    }

    const supabase = createRouteHandlerSupabaseClient()
    
    // Verificar na tabela email_verification_codes se existe algum código verificado para este email
    const { data: verifiedCodes, error: codesError } = await supabase
      .from('email_verification_codes')
      .select('id, verified, created_at')
      .eq('email', email.toLowerCase())
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (codesError) {
      console.error('Erro ao verificar códigos de verificação:', codesError)
      
      // Se a tabela não existir, retornar como não verificado
      if (codesError.code === '42P01' || codesError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Tabela de verificação não configurada',
          exists: false,
          verified: false
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Erro ao verificar email',
        exists: false,
        verified: false
      }, { status: 500 })
    }

    // Se existe código verificado na tabela, o email foi verificado
    const isVerified = verifiedCodes && verifiedCodes.length > 0
    
    // Verificar se existe algum código para este email (mesmo não verificado) para saber se o email existe no sistema
    const { data: anyCodes } = await supabase
      .from('email_verification_codes')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1)
    
    const exists = (anyCodes && anyCodes.length > 0) || isVerified
    
    console.log('Verificação de email:', {
      email,
      exists,
      verified: isVerified,
      verified_codes_count: verifiedCodes?.length || 0,
      total_codes_count: anyCodes?.length || 0
    })

    return NextResponse.json({ 
      exists,
      verified: isVerified
    })
  } catch (error: any) {
    console.error('Erro ao verificar email:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar email',
      exists: false,
      verified: false
    }, { status: 500 })
  }
}


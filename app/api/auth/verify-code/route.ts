import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient, createSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Verifica código de verificação de email
 * POST /api/auth/verify-code
 * Body: { email: string, code: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email e código são obrigatórios' }, { status: 400 })
    }

    console.log('🔍 Verificando código:', { email, code: code.substring(0, 2) + '****' })
    
    const supabase = createRouteHandlerSupabaseClient()

    // Buscar código de verificação
    // Primeiro, buscar todos os códigos para este email para debug
    const { data: allCodes, error: debugError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log('📋 Códigos encontrados para este email:', {
      count: allCodes?.length || 0,
      codes: allCodes?.map(c => ({ 
        id: c.id.substring(0, 8), 
        code: c.code.substring(0, 2) + '****',
        verified: c.verified,
        expires_at: c.expires_at,
        created_at: c.created_at
      }))
    })

    const { data: verificationCode, error: fetchError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('Erro ao buscar código de verificação:', {
        error: fetchError,
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint
      })
      
      // Verificar se é erro de tabela não encontrada
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Tabela de verificação não configurada. Execute a migration 031_create_email_verification_codes.sql no Supabase.' 
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Erro ao verificar código',
        details: process.env.NODE_ENV === 'development' ? fetchError.message : undefined
      }, { status: 500 })
    }

    if (!verificationCode) {
      console.log('❌ Código não encontrado ou inválido')
      // Tentar buscar sem filtro de expiração para debug
      const { data: anyCode } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (anyCode) {
        console.log('⚠️ Código encontrado mas:', {
          verified: anyCode.verified,
          expires_at: anyCode.expires_at,
          now: new Date().toISOString(),
          expired: new Date(anyCode.expires_at) < new Date()
        })
      }
      
      return NextResponse.json({ 
        error: 'Código inválido ou expirado. Por favor, solicite um novo código.' 
      }, { status: 400 })
    }
    
    console.log('✅ Código encontrado:', { id: verificationCode.id.substring(0, 8) })

    // Marcar código como verificado
    // Usar admin client para garantir que a atualização funcione (bypass RLS se necessário)
    const supabaseAdmin = createSupabaseAdmin()
    const { error: updateError } = await supabaseAdmin
      .from('email_verification_codes')
      .update({ verified: true })
      .eq('id', verificationCode.id)

    if (updateError) {
      console.error('❌ Erro ao marcar código como verificado:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      })
      
      // Se for erro de permissão RLS, tentar usar service role
      if (updateError.code === '42501' || updateError.message?.includes('permission denied')) {
        console.log('⚠️ Erro de permissão RLS detectado. Verifique as políticas da tabela.')
        return NextResponse.json({ 
          error: 'Erro de permissão ao verificar código. Entre em contato com o suporte.',
          details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Erro ao verificar código',
        details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
      }, { status: 500 })
    }
    
    console.log('✅ Código marcado como verificado com sucesso')

    // Verificar se o usuário já existe e confirmar o email no Supabase
    try {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = users.find(u => u.email === email)
      
      if (existingUser && !existingUser.email_confirmed_at) {
        // Confirmar email no Supabase
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { email_confirm: true }
        )
        
        if (confirmError) {
          console.warn('Aviso: Não foi possível confirmar email no Supabase:', confirmError)
          // Continuar mesmo se falhar, pois o código foi verificado
        } else {
          console.log('✅ Email confirmado no Supabase com sucesso')
        }
      }
    } catch (confirmError) {
      console.warn('Aviso: Erro ao confirmar email no Supabase:', confirmError)
      // Continuar mesmo se falhar, pois o código foi verificado
    }

    return NextResponse.json({ 
      success: true,
      message: 'Código verificado com sucesso'
    })
  } catch (error: any) {
    console.error('Erro ao verificar código:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar código' 
    }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient, createSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Verifica se um CPF/CNPJ já está cadastrado
 * POST /api/auth/check-cpf
 * Body: { cpf_cnpj: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { cpf_cnpj } = await request.json()

    if (!cpf_cnpj) {
      return NextResponse.json({ error: 'CPF/CNPJ não informado' }, { status: 400 })
    }

    // Limpar CPF/CNPJ (remover caracteres não numéricos)
    const cleanCpfCnpj = cpf_cnpj.replace(/\D/g, '')

    if (cleanCpfCnpj.length < 11) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    // Usar admin client para garantir que a verificação funcione mesmo com RLS
    const supabaseAdmin = createSupabaseAdmin()

    // Verificar se já existe um perfil com este CPF/CNPJ
    const { data: existingProfile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, cpf_cnpj')
      .eq('cpf_cnpj', cleanCpfCnpj)
      .maybeSingle()

    if (error) {
      console.error('Erro ao verificar CPF/CNPJ:', error)
      return NextResponse.json({ error: 'Erro ao verificar CPF/CNPJ' }, { status: 500 })
    }

    if (existingProfile) {
      return NextResponse.json({ 
        exists: true, 
        message: 'Este CPF/CNPJ já está cadastrado' 
      })
    }

    return NextResponse.json({ exists: false })
  } catch (error: any) {
    console.error('Erro ao verificar CPF/CNPJ:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar CPF/CNPJ' 
    }, { status: 500 })
  }
}


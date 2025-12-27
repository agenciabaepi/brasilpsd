import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Verifica se um email já está cadastrado (sem enviar código)
 * POST /api/auth/check-email
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email não informado' }, { status: 400 })
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Verificar se email já está cadastrado (usar admin para buscar em auth.users)
    try {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = users.find(u => u.email === email)
      
      if (existingUser) {
        return NextResponse.json({ 
          exists: true, 
          message: 'Este email já está cadastrado' 
        })
      }

      return NextResponse.json({ exists: false })
    } catch (checkError: any) {
      console.error('Erro ao verificar email:', checkError)
      return NextResponse.json({ error: 'Erro ao verificar email' }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Erro ao verificar email:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao verificar email' 
    }, { status: 500 })
  }
}



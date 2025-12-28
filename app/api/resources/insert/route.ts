import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient, createSupabaseAdmin } from '@/lib/supabase/server'

/**
 * API Route para inserir recursos com tipos de enum que podem ter problemas de cache
 * Usa cliente admin para contornar validação do PostgREST
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resourceData = await request.json()

    // Verificar se é PNG e fazer insert via estratégia em 2 passos
    if (resourceData.resource_type === 'png') {
      const adminClient = createSupabaseAdmin()
      
      // ESTRATÉGIA: Inserir como 'image' primeiro (sempre funciona), depois atualizar para 'png'
      const { resource_type, ...dataWithoutType } = resourceData
      const insertData = { ...dataWithoutType, resource_type: 'image' }
      
      // Passo 1: Inserir como 'image'
      const { data: inserted, error: insertError } = await adminClient
        .from('resources')
        .insert(insertData)
        .select()
        .single()

      if (insertError || !inserted) {
        console.error('❌ Failed to insert as image:', insertError)
        return NextResponse.json({ 
          error: insertError?.message || 'Failed to insert resource' 
        }, { status: 500 })
      }

      // Passo 2: Atualizar resource_type para 'png' via SQL direto com cast explícito
      console.log('🔄 Updating resource_type to png for resource:', inserted.id)
      
      // Tentar múltiplas estratégias de UPDATE
      let updateSuccess = false
      
      // Estratégia 1: RPC function
      const { error: rpcError } = await adminClient.rpc('update_resource_type_to_png', {
        resource_id: inserted.id
      })

      if (!rpcError) {
        console.log('✅ RPC update succeeded')
        updateSuccess = true
      } else {
        console.error('❌ RPC update failed:', rpcError)
        
        // Estratégia 2: UPDATE direto via PostgREST (pode funcionar com admin)
        const { error: directError } = await adminClient
          .from('resources')
          .update({ resource_type: 'png' as any })
          .eq('id', inserted.id)

        if (!directError) {
          console.log('✅ Direct update succeeded')
          updateSuccess = true
        } else {
          console.error('❌ Direct update failed:', directError)
          
          // Estratégia 3: SQL direto via função helper
          const { error: sqlError } = await adminClient.rpc('exec_sql_update', {
            table_name: 'resources',
            set_clause: "resource_type = 'png'::resource_type",
            where_clause: `id = '${inserted.id}'::uuid`
          })

          if (!sqlError) {
            console.log('✅ SQL update succeeded')
            updateSuccess = true
          } else {
            console.error('❌ SQL update failed:', sqlError)
          }
        }
      }

      if (!updateSuccess) {
        console.error('❌ All update strategies failed')
        return NextResponse.json({ 
          data: inserted, 
          error: null,
          warning: `Resource inserted but type update failed. Resource ID: ${inserted.id}. Please update manually via SQL: UPDATE resources SET resource_type = 'png'::resource_type WHERE id = '${inserted.id}'`
        })
      }

      // Aguardar um pouco para garantir que o UPDATE foi processado
      await new Promise(resolve => setTimeout(resolve, 100))

      // Buscar recurso atualizado
      const { data: finalResource, error: fetchError } = await adminClient
        .from('resources')
        .select('*')
        .eq('id', inserted.id)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching updated resource:', fetchError)
        return NextResponse.json({ 
          data: inserted, 
          error: null,
          warning: 'Resource inserted but could not verify update. Please check manually.'
        })
      }

      // Verificar se realmente foi atualizado
      if (finalResource && finalResource.resource_type === 'png') {
        console.log('✅ Resource type successfully updated to png')
        return NextResponse.json({ data: finalResource, error: null })
      } else {
        console.warn('⚠️ Resource type is still:', finalResource?.resource_type || 'unknown')
        return NextResponse.json({ 
          data: finalResource || inserted, 
          error: null,
          warning: `Resource type may still be '${finalResource?.resource_type || 'image'}'. Please verify and update manually if needed.`
        })
      }
    }

    // Para outros tipos, usar insert normal
    const { data, error } = await supabase
      .from('resources')
      .insert(resourceData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, error: null })
  } catch (error: any) {
    console.error('❌ Error in insert resource API:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao inserir recurso' },
      { status: 500 }
    )
  }
}


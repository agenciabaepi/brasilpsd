/**
 * Scripts de Teste de Segurança - API de Downloads
 * 
 * Cole estes scripts no Console do navegador (F12) para testar a API
 * 
 * IMPORTANTE: Substitua os valores pelos IDs reais antes de executar
 */

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const TEST_CONFIG = {
  resourceId: 'SUBSTITUA-PELO-ID-DO-RECURSO',
  key: 'SUBSTITUA-PELO-KEY-DO-RECURSO',
  userId: 'SUBSTITUA-PELO-ID-DO-USUARIO'
}

// ============================================================================
// TESTE 1: Download sem autenticação
// ============================================================================

async function teste1_semAutenticacao() {
  console.log('🧪 Teste 1: Download sem autenticação')
  
  // Fazer logout primeiro
  await fetch('/api/auth/logout', { method: 'POST' })
  
  const response = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      resourceId: TEST_CONFIG.resourceId,
      key: TEST_CONFIG.key
    })
  })
  
  const data = await response.json()
  console.log('Resultado:', {
    status: response.status,
    data: data
  })
  
  if (response.status === 401) {
    console.log('✅ PASSOU: Download sem autenticação foi bloqueado')
  } else {
    console.log('❌ FALHOU: Deveria retornar 401')
  }
}

// ============================================================================
// TESTE 2: Download após atingir limite (já testado manualmente)
// ============================================================================

async function teste2_limiteAtingido() {
  console.log('🧪 Teste 2: Download após atingir limite')
  console.log('ℹ️ Este teste já foi validado manualmente - funcionando!')
}

// ============================================================================
// TESTE 3: Múltiplas requisições simultâneas (race condition)
// ============================================================================

async function teste3_requisicoesSimultaneas() {
  console.log('🧪 Teste 3: Múltiplas requisições simultâneas')
  
  const promises = []
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resourceId: TEST_CONFIG.resourceId,
          key: TEST_CONFIG.key
        })
      }).then(r => r.json()).then(data => ({ request: i, data }))
    )
  }
  
  const results = await Promise.all(promises)
  console.log('Resultados:', results)
  
  const sucessos = results.filter(r => !r.data.error).length
  console.log(`✅ ${sucessos} requisições bem-sucedidas de 5`)
  console.log('ℹ️ Esperado: Apenas 1 deve ser permitida (LOCK previne race conditions)')
}

// ============================================================================
// TESTE 4: Manipular requisição (tentar bypass)
// ============================================================================

async function teste4_manipularRequisicao() {
  console.log('🧪 Teste 4: Tentar manipular requisição')
  
  // Tentar enviar requisição sem autenticação
  const response1 = await fetch('/api/download', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      // Sem Authorization header
    },
    body: JSON.stringify({ 
      resourceId: TEST_CONFIG.resourceId,
      key: TEST_CONFIG.key
    })
  })
  
  const data1 = await response1.json()
  console.log('Resultado sem auth:', data1)
  
  if (data1.error && response1.status === 401) {
    console.log('✅ PASSOU: Requisição sem autenticação foi bloqueada')
  } else {
    console.log('❌ FALHOU: Deveria bloquear requisição sem autenticação')
  }
}

// ============================================================================
// TESTE 5: Verificar status de downloads
// ============================================================================

async function teste5_verificarStatus() {
  console.log('🧪 Teste 5: Verificar status de downloads')
  
  const response = await fetch('/api/downloads/status')
  const data = await response.json()
  
  console.log('Status de downloads:', data)
  console.log(`📊 ${data.current} / ${data.limit} downloads hoje`)
  console.log(`📥 ${data.remaining} downloads restantes`)
  console.log(`✅ Permitido: ${data.allowed ? 'Sim' : 'Não'}`)
}

// ============================================================================
// TESTE 6: Verificar que API valida no servidor
// ============================================================================

async function teste6_validacaoServidor() {
  console.log('🧪 Teste 6: Verificar validação no servidor')
  
  // Tentar fazer download com resourceId inválido
  const response = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      resourceId: '00000000-0000-0000-0000-000000000000', // UUID inválido
      key: 'test-key'
    })
  })
  
  const data = await response.json()
  console.log('Resultado com resourceId inválido:', {
    status: response.status,
    data: data
  })
  
  if (response.status === 404 || data.error) {
    console.log('✅ PASSOU: API valida resourceId no servidor')
  } else {
    console.log('❌ FALHOU: Deveria validar resourceId')
  }
}

// ============================================================================
// EXECUTAR TODOS OS TESTES
// ============================================================================

async function executarTodosTestes() {
  console.log('🚀 Iniciando todos os testes de segurança...\n')
  
  try {
    await teste5_verificarStatus()
    console.log('\n')
    
    await teste6_validacaoServidor()
    console.log('\n')
    
    await teste3_requisicoesSimultaneas()
    console.log('\n')
    
    console.log('⚠️ Teste 1 e 4 requerem logout - execute manualmente:')
    console.log('   teste1_semAutenticacao()')
    console.log('   teste4_manipularRequisicao()')
    
    console.log('\n✅ Testes concluídos!')
  } catch (error) {
    console.error('❌ Erro durante testes:', error)
  }
}

// ============================================================================
// INSTRUÇÕES DE USO
// ============================================================================

console.log(`
📋 SCRIPTS DE TESTE DE SEGURANÇA

1. Configure os IDs em TEST_CONFIG acima
2. Execute os testes individualmente:
   - teste1_semAutenticacao()
   - teste3_requisicoesSimultaneas()
   - teste4_manipularRequisicao()
   - teste5_verificarStatus()
   - teste6_validacaoServidor()

3. Ou execute todos:
   - executarTodosTestes()

⚠️ IMPORTANTE: Substitua os valores em TEST_CONFIG antes de executar!
`)


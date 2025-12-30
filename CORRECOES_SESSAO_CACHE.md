# Correções de Sessão e Cache - BrasilPSD

## Problemas Identificados e Corrigidos

### 1. **Biblioteca Desatualizada** ✅
- **Problema**: O projeto estava usando `@supabase/auth-helpers-nextjs` que está **DEPRECADA**
- **Solução**: Migrado para `@supabase/ssr` (biblioteca oficial e atualizada)
- **Arquivos alterados**:
  - `package.json` - Atualizada dependência
  - `middleware.ts` - Refatorado para usar `createServerClient` do `@supabase/ssr`
  - `lib/supabase/client.ts` - Refatorado para usar `createBrowserClient`
  - `lib/supabase/server.ts` - Refatorado para usar `createServerClient`

### 2. **Cache Manual Problemático** ✅
- **Problema**: Cache manual no `client.ts` estava causando problemas de sessão
- **Solução**: Removido cache manual, deixando a biblioteca gerenciar automaticamente

### 3. **Loops de Carregamento** ✅
- **Problema**: Uso excessivo de `router.refresh()` causando loops infinitos
- **Solução**: Substituído `router.refresh()` por `window.location.href` em operações críticas (login/logout)
- **Arquivos corrigidos**:
  - `components/layout/Header.tsx`
  - `app/(main)/login/page.tsx`
  - `app/(main)/dashboard/page.tsx`
  - `app/(main)/settings/page.tsx`
  - `app/(main)/account/page.tsx`
  - `components/user/UserSidebar.tsx`
  - `components/admin/AdminSidebar.tsx`
  - `components/creator/CreatorSidebar.tsx`

### 4. **Configurações de Cache** ✅
- **Problema**: Configurações de cache muito agressivas em desenvolvimento
- **Solução**: Otimizadas configurações no `next.config.js`
  - Removidos headers de cache que causavam problemas
  - Ajustado `onDemandEntries` para valores mais razoáveis

### 5. **Otimização do Header** ✅
- **Problema**: `useEffect` no Header poderia causar re-renders desnecessários
- **Solução**: Adicionado controle de montagem (`mounted`) e melhor gerenciamento de subscriptions

## Instruções para Deploy

### 1. Instalar Dependências Atualizadas

```bash
npm install
```

Isso instalará a nova biblioteca `@supabase/ssr` e removerá a antiga `@supabase/auth-helpers-nextjs`.

### 2. Testar Localmente

```bash
npm run dev
```

Teste especialmente:
- Login/Logout
- Navegação entre páginas protegidas
- Verificação de sessão persistente
- Não deve haver loops de carregamento

### 3. Limpar Cache Antes do Deploy

```bash
npm run clean:all
```

### 4. Build de Produção

```bash
npm run build
```

Verifique se não há erros de compilação.

### 5. Deploy na Vercel

1. Faça commit das mudanças:
```bash
git add .
git commit -m "fix: atualizar autenticação Supabase e corrigir problemas de sessão/cache"
git push
```

2. O deploy automático na Vercel deve funcionar, mas se necessário:
   - Vá para o painel da Vercel
   - Force um novo deploy
   - Certifique-se de que as variáveis de ambiente estão configuradas:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (se necessário)

### 6. Verificações Pós-Deploy

Após o deploy, verifique:
- [ ] Login funciona corretamente
- [ ] Sessão persiste após refresh da página
- [ ] Logout funciona e limpa a sessão
- [ ] Não há loops de carregamento
- [ ] Páginas protegidas redirecionam corretamente
- [ ] Middleware funciona para rotas admin/creator

## Mudanças Técnicas Detalhadas

### Middleware
- Agora usa `createServerClient` do `@supabase/ssr`
- Gerencia cookies corretamente para SSR
- Mantém compatibilidade com todas as rotas protegidas

### Cliente Supabase (Browser)
- Usa `createBrowserClient` que gerencia cookies automaticamente
- Sem cache manual que causava problemas
- Sincronização automática de sessão

### Cliente Supabase (Server)
- Usa `createServerClient` com gerenciamento correto de cookies
- Suporta Server Components e Route Handlers
- Tratamento de erros melhorado

## Notas Importantes

1. **Não use mais `router.refresh()`** após login/logout - use `window.location.href` para garantir limpeza completa do estado

2. **A biblioteca `@supabase/ssr`** gerencia automaticamente:
   - Refresh de tokens
   - Sincronização de sessão
   - Cookies HTTP-only

3. **Cache do Next.js**: As configurações foram otimizadas, mas se ainda houver problemas, considere:
   - Limpar cache do navegador
   - Usar modo anônimo para testar
   - Verificar headers de cache na Vercel

## Troubleshooting

### Se a sessão ainda não persistir:
1. Verifique se as variáveis de ambiente estão corretas
2. Verifique se os cookies estão sendo setados (DevTools > Application > Cookies)
3. Verifique se não há bloqueadores de cookies no navegador

### Se ainda houver loops:
1. Verifique o console do navegador para erros
2. Verifique se não há múltiplos `useEffect` disparando ao mesmo tempo
3. Use React DevTools para verificar re-renders

### Se o deploy falhar:
1. Verifique se todas as dependências estão no `package.json`
2. Verifique se não há erros de TypeScript (`npm run type-check`)
3. Verifique os logs de build na Vercel

## Suporte

Se encontrar problemas após essas correções, verifique:
- Versão do Node.js (recomendado: 18.x ou superior)
- Versão do npm (recomendado: 9.x ou superior)
- Logs do servidor e do cliente
- Network tab no DevTools para verificar requisições





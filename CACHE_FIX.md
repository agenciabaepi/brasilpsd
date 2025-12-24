# 🔧 Como Resolver Problemas de Cache

Se o site não está carregando após alterações, siga estes passos:

## Solução Rápida

1. **Pare o servidor** (Ctrl+C no terminal)

2. **Limpe o cache do Next.js:**
   ```bash
   npm run clean
   ```

3. **Reinicie o servidor:**
   ```bash
   npm run dev
   ```

## Solução Completa (se a rápida não funcionar)

1. **Pare o servidor** (Ctrl+C)

2. **Limpe tudo:**
   ```bash
   npm run clean:all
   ```

3. **Limpe o cache do navegador:**
   - Chrome/Edge: `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
   - Selecione "Imagens e arquivos em cache"
   - Ou use modo anônimo: `Ctrl+Shift+N` (Windows) ou `Cmd+Shift+N` (Mac)

4. **Reinicie o servidor:**
   ```bash
   npm run dev
   ```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor normalmente
- `npm run dev:clean` - Limpa cache e inicia o servidor
- `npm run clean` - Limpa apenas o cache do Next.js
- `npm run clean:all` - Limpa cache do Next.js e Turbo

## Dica

Se o problema persistir, use sempre o modo anônimo do navegador para testar, ou force o reload:
- Windows/Linux: `Ctrl+Shift+R` ou `Ctrl+F5`
- Mac: `Cmd+Shift+R`


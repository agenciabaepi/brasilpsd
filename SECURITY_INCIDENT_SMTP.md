# 🚨 Incidente de Segurança: Credenciais SMTP Expostas

## ⚠️ Problema Identificado

O GitGuardian detectou que credenciais SMTP foram expostas no repositório GitHub. A senha estava hardcoded no arquivo `lib/email/config.ts`.

## ✅ Correções Aplicadas

1. **Removidas credenciais hardcoded** do código
2. **Obrigatório uso de variáveis de ambiente** - o código agora exige que todas as credenciais sejam fornecidas via variáveis de ambiente
3. **Validação melhorada** - o código valida se todas as variáveis necessárias estão configuradas

## 🔒 Ações Imediatas Necessárias

### 1. Alterar a Senha SMTP (URGENTE)

**A senha `@Deusefiel7loja2025` foi exposta e deve ser alterada IMEDIATAMENTE:**

1. Acesse o painel da Hostinger
2. Vá em **Email** > **Contas de Email**
3. Selecione `suporte@brasilpsd.com.br`
4. Altere a senha para uma nova senha forte
5. Atualize a variável de ambiente `SMTP_PASSWORD` em todos os ambientes (local, produção, etc.)

### 2. Verificar Histórico do Git

**✅ CONFIRMADO:** A senha está no histórico do Git no commit `13e469df0f9b1c34283c04bf78dc3d77d319956f`.

**Opções para remover do histórico:**

#### Opção A: Usar BFG Repo-Cleaner (Recomendado - Mais Seguro)

```bash
# 1. Instalar BFG (se não tiver)
# brew install bfg  # macOS
# ou baixar de: https://rtyley.github.io/bfg-repo-cleaner/

# 2. Criar backup do repositório
cd /Users/lucasoliveira/BrasilPsd
git clone --mirror . ../BrasilPsd-backup.git

# 3. Remover a senha do histórico
bfg --replace-text passwords.txt

# Onde passwords.txt contém:
# @Deusefiel7loja2025==>REMOVED

# 4. Limpar e fazer push
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (CUIDADO: isso reescreve o histórico)
git push --force --all
git push --force --tags
```

#### Opção B: Usar git filter-branch

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch lib/email/config.ts" \
  --prune-empty --tag-name-filter cat -- --all

# Depois limpar
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now

# Force push
git push --force --all
git push --force --tags
```

**⚠️ ATENÇÃO CRÍTICA:**
- Se o repositório é **público**, a senha já foi exposta e deve ser alterada IMEDIATAMENTE
- Se o repositório foi clonado por outras pessoas, elas ainda terão acesso à senha no histórico
- Force push reescreve o histórico - avise sua equipe antes
- Considere tornar o repositório privado temporariamente durante a limpeza

### 3. Atualizar Variáveis de Ambiente

Certifique-se de que as seguintes variáveis estão configuradas em **TODOS** os ambientes:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=suporte@brasilpsd.com.br
SMTP_PASSWORD=nova_senha_segura_aqui
```

**Locais onde configurar:**
- ✅ Arquivo `.env.local` (desenvolvimento local)
- ✅ Vercel (Settings > Environment Variables)
- ✅ Qualquer outro serviço de deploy

### 4. Verificar Outras Credenciais Expostas

Execute uma busca no repositório por outras possíveis credenciais:

```bash
# Buscar por padrões comuns de credenciais
grep -r "password.*=" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -r "secret.*=" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -r "api.*key" --include="*.ts" --include="*.tsx" --include="*.js" -i .
```

### 5. Configurar GitGuardian (Recomendado)

1. Acesse: https://www.gitguardian.com
2. Conecte seu repositório GitHub
3. Configure alertas para detectar futuras exposições de credenciais

## 📋 Checklist de Segurança

- [ ] Senha SMTP alterada na Hostinger
- [ ] Variável `SMTP_PASSWORD` atualizada em todos os ambientes
- [ ] Histórico do Git verificado
- [ ] Outras credenciais verificadas no código
- [ ] GitGuardian configurado (opcional mas recomendado)
- [ ] Documentação atualizada (removidas referências à senha antiga)

## 🔐 Boas Práticas para o Futuro

1. **NUNCA** commite credenciais no código
2. **SEMPRE** use variáveis de ambiente
3. Use arquivos `.env.example` com valores de exemplo (não reais)
4. Verifique o `.gitignore` regularmente
5. Use ferramentas como GitGuardian ou GitHub Secret Scanning
6. Rotacione credenciais regularmente
7. Use senhas fortes e únicas para cada serviço

## 📝 Arquivos Modificados

- `lib/email/config.ts` - Removidas credenciais hardcoded, agora exige variáveis de ambiente

## ⏰ Próximos Passos

1. **IMEDIATO:** Alterar senha SMTP na Hostinger
2. **HOJE:** Atualizar variáveis de ambiente em todos os ambientes
3. **ESTA SEMANA:** Verificar histórico do Git e limpar se necessário
4. **CONTÍNUO:** Monitorar por outras exposições de credenciais

---

**Data do Incidente:** 26 de Dezembro de 2025  
**Status:** ✅ Corrigido no código | ⚠️ Ação do usuário necessária (alterar senha)


# BrasilPSD - Plataforma de Recursos Digitais

Sistema profissional para download de imagens, vídeos, fontes, PSD, AI, áudio e outros recursos digitais.

## 🚀 Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Supabase** - Banco de dados e autenticação
- **AWS S3 + CloudFront** - Armazenamento e CDN
- **Tailwind CSS** - Estilização
- **Framer Motion** - Animações

## 📋 Funcionalidades

### Para Usuários
- Busca e download de recursos
- Dashboard pessoal
- Histórico de downloads
- Favoritos

### Para Criadores
- Upload de recursos
- Dashboard de estatísticas
- Sistema de aprovação
- Comissões (futuro)

### Para Administradores
- Gestão completa do sistema
- Aprovação de recursos
- Gestão de usuários
- Relatórios e analytics

## 🛠️ Instalação

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.local.example .env.local
```

4. Configure o Supabase e execute as migrations

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## 📁 Estrutura do Projeto

```
/app              - Rotas e páginas
/components       - Componentes reutilizáveis
/lib              - Utilitários e configurações
/types            - Tipos TypeScript
/public           - Arquivos estáticos
```

## 🔐 Variáveis de Ambiente

Veja `.env.local.example` para todas as variáveis necessárias.


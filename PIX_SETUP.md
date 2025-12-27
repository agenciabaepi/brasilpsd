# Configuração PIX no Asaas - Resolução do Erro QR126E

## Problema

O erro **QR126E** ("O QR Code não é válido") ocorre quando a conta Asaas não tem uma chave PIX cadastrada ou quando o QR Code gerado não está configurado corretamente.

## Solução

### 1. Cadastrar Chave PIX no Asaas

1. **Acesse o painel do Asaas:**
   - Para produção: https://www.asaas.com
   - Para sandbox: https://sandbox.asaas.com

2. **Vá em Configurações > Integrações > PIX:**
   - Clique em "Cadastrar Chave PIX"
   - Escolha o tipo de chave (CPF, CNPJ, Email, Telefone ou Chave Aleatória)
   - Complete o cadastro conforme solicitado

3. **Aguarde a confirmação:**
   - A chave PIX precisa ser confirmada pelo Asaas
   - Isso pode levar alguns minutos ou horas

### 2. Verificar Ambiente (Sandbox vs Produção)

- **Sandbox:** QR Codes podem não funcionar para pagamentos reais
- **Produção:** Certifique-se de usar a API de produção e ter chave PIX cadastrada

### 3. Configurar Variáveis de Ambiente

Verifique se as variáveis estão corretas:

```env
# Para sandbox
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_API_KEY=sua_chave_sandbox

# Para produção
ASAAS_API_URL=https://www.asaas.com/api/v3
ASAAS_API_KEY=sua_chave_producao
```

### 4. Validade do QR Code

- **Com chave PIX cadastrada:** QR Codes dinâmicos são válidos por vários dias
- **Sem chave PIX cadastrada:** QR Codes dinâmicos expiram às 23h59 do mesmo dia

## Alternativa: Usar Código PIX Copiável

Mesmo se o QR Code não funcionar, o código PIX copiável (payload) deve funcionar:

1. O código copiável é exibido na tela de pagamento
2. Copie o código e cole no app do banco
3. O pagamento será processado normalmente

## Verificação

Após cadastrar a chave PIX, teste novamente:

1. Gere um novo pagamento PIX
2. Verifique se o QR Code é exibido corretamente
3. Tente escanear o QR Code no app do banco
4. Se o QR Code ainda falhar, use o código copiável

## Documentação Oficial

- [Asaas - Como adicionar chave PIX](https://central.ajuda.asaas.com/hc/pt-br/articles/36097307217307)
- [Asaas - QR Code PIX](https://docs.asaas.com/reference/criar-cobranca-pix)



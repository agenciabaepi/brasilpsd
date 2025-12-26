/**
 * Valida CPF usando algoritmo de dígitos verificadores
 * @param cpf CPF sem formatação (apenas números)
 * @returns true se CPF é válido
 */
export function validateCPF(cpf: string): boolean {
  // Remover caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '')
  
  // Verificar se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    return false
  }
  
  // Verificar se todos os dígitos são iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false
  }
  
  // Validar primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i)
  }
  let digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cleanCPF.charAt(9))) {
    return false
  }
  
  // Validar segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i)
  }
  digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cleanCPF.charAt(10))) {
    return false
  }
  
  return true
}

/**
 * Valida CNPJ usando algoritmo de dígitos verificadores
 * @param cnpj CNPJ sem formatação (apenas números)
 * @returns true se CNPJ é válido
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remover caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '')
  
  // Verificar se tem 14 dígitos
  if (cleanCNPJ.length !== 14) {
    return false
  }
  
  // Verificar se todos os dígitos são iguais (ex: 11.111.111/1111-11)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return false
  }
  
  // Validar primeiro dígito verificador
  let length = cleanCNPJ.length - 2
  let numbers = cleanCNPJ.substring(0, length)
  const digits = cleanCNPJ.substring(length)
  let sum = 0
  let pos = length - 7
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) {
    return false
  }
  
  // Validar segundo dígito verificador
  length = length + 1
  numbers = cleanCNPJ.substring(0, length)
  sum = 0
  pos = length - 7
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) {
    return false
  }
  
  return true
}

/**
 * Valida CPF ou CNPJ
 * @param cpfCnpj CPF ou CNPJ sem formatação (apenas números)
 * @returns true se é válido (CPF ou CNPJ)
 */
export function validateCPForCNPJ(cpfCnpj: string): boolean {
  const clean = cpfCnpj.replace(/\D/g, '')
  
  if (clean.length === 11) {
    return validateCPF(clean)
  } else if (clean.length === 14) {
    return validateCNPJ(clean)
  }
  
  return false
}


/**
 * Utilitário simples para verificar formatos de design files
 * Pode ser usado tanto no cliente quanto no servidor
 * Não tem dependências de Node.js
 */

/**
 * Verifica se um formato de arquivo é suportado para geração automática de thumbnail
 * Esta função pode ser usada no cliente sem problemas
 */
export function isDesignFileFormatSupported(fileExtension: string): boolean {
  const ext = fileExtension.toLowerCase().replace('.', '')
  const supportedFormats = ['psd', 'eps', 'ai', 'svg', 'pdf']
  return supportedFormats.includes(ext)
}


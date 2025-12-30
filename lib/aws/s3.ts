import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommandInput } from '@aws-sdk/client-s3'

// Garantindo Ohio us-east-2 como padrão absoluto
const REGION = process.env.AWS_REGION || 'us-east-2'
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'brasilpsd-arquivos'
const CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

/**
 * Sanitiza o nome do arquivo para uso em headers HTTP
 * Remove caracteres inválidos que podem causar erros em headers
 */
function sanitizeMetadataValue(value: string): string {
  if (!value) return ''
  
  // Remover caracteres de controle e caracteres inválidos para headers HTTP
  // Headers HTTP não podem conter: \r, \n, caracteres de controle (0x00-0x1F), etc.
  return value
    .replace(/[\r\n\t]/g, ' ') // Substituir quebras de linha e tabs por espaço
    .replace(/[\x00-\x1F\x7F]/g, '') // Remover caracteres de controle
    .replace(/[^\x20-\x7E]/g, '') // Manter apenas caracteres ASCII imprimíveis
    .trim()
    .substring(0, 1024) // Limitar tamanho (S3 metadata tem limite)
}

/**
 * Sanitiza metadata antes de enviar para S3
 * Garante que todos os valores sejam válidos para headers HTTP
 */
function sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
  if (!metadata) return undefined
  
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value) {
      sanitized[key] = sanitizeMetadataValue(value)
    }
  }
  return sanitized
}

export interface UploadFileParams {
  file: Buffer | Uint8Array
  key: string
  contentType: string
  metadata?: Record<string, string>
}

export async function uploadFileToS3({
  file,
  key,
  contentType,
  metadata,
}: UploadFileParams): Promise<string> {
  console.log('S3 Upload:', {
    bucket: BUCKET_NAME,
    key: key,
    contentType: contentType,
    size: file.length,
    region: REGION
  })

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    Metadata: sanitizeMetadata(metadata),
    // Removendo ACL pública explícita para evitar erros se o bucket não permitir ACLs
  })

  try {
    await s3Client.send(command)
    console.log('S3 Upload successful for key:', key)
  } catch (error) {
    console.error('S3 Upload error:', error)
    throw error
  }

  // PRIORIDADE 1: CloudFront (Ignora se for o link de exemplo ou undefined)
  const isDummyCloudfront = CLOUDFRONT_DOMAIN?.includes('seu-cloudfront-domain') || CLOUDFRONT_DOMAIN === 'undefined' || !CLOUDFRONT_DOMAIN;
  
  if (!isDummyCloudfront) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`
  }
  
  // PRIORIDADE 2: Link direto S3 (Formato Ohio us-east-2)
  return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`
}

export function getS3Url(key: string): string {
  if (!key) return ''
  const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'brasilpsd-arquivos'
  const REG = process.env.AWS_REGION || 'us-east-2'

  if (key.startsWith('http')) {
    // Se o link for o quebrado (cloudfront de exemplo), corrige ele na hora
    if (key.includes('seu-cloudfront-domain.cloudfront.net')) {
      return key.replace(/https:\/\/.*\.cloudfront\.net\//, `https://${BUCKET}.s3.${REG}.amazonaws.com/`)
    }
    return key
  }
  return `https://${BUCKET}.s3.${REG}.amazonaws.com/${key}`
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Gera uma presigned URL para upload direto do cliente para S3
 * Isso permite uploads grandes sem passar pelo servidor Next.js
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600,
  metadata?: Record<string, string>
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: sanitizeMetadata(metadata),
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

export async function deleteFileFromS3(key: string): Promise<void> {
  console.log('S3 Delete:', {
    bucket: BUCKET_NAME,
    key: key,
    region: REGION
  })

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  try {
    const response = await s3Client.send(command)
    console.log('S3 Delete successful for key:', key, 'Response:', response)
  } catch (error: any) {
    console.error('S3 Delete error:', {
      key: key,
      error: error.message,
      code: error.Code,
      name: error.name,
      bucket: BUCKET_NAME
    })
    throw error
  }
}

// Conveniência: gerar signed URL de download
export async function getSignedS3Url(key: string, expiresIn: number = 3600) {
  return getSignedDownloadUrl(key, expiresIn)
}

// Conveniência: upload a partir de Buffer retornando publicUrl
export async function uploadToS3FromBuffer(
  buffer: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
) {
  const url = await uploadFileToS3({
    file: buffer,
    key,
    contentType,
    metadata,
  })
  return { publicUrl: url, key }
}

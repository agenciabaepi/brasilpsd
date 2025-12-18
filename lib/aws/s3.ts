import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    Metadata: metadata,
    // Removendo ACL pública explícita para evitar erros se o bucket não permitir ACLs
  })

  await s3Client.send(command)

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

export async function deleteFileFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

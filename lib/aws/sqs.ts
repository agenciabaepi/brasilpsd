import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

const REGION = process.env.AWS_REGION || 'us-east-2'
const QUEUE_URL = process.env.SQS_QUEUE_URL

const sqsClient = new SQSClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export interface VideoProcessingMessage {
  resourceId: string
  key: string
  userId: string
  fileName: string
  contentType: string
}

/**
 * Envia mensagem para fila SQS de processamento de vídeo
 */
export async function enqueueVideoProcessing(message: VideoProcessingMessage): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error('SQS_QUEUE_URL não configurado')
  }

  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      resourceId: {
        DataType: 'String',
        StringValue: message.resourceId,
      },
      userId: {
        DataType: 'String',
        StringValue: message.userId,
      },
      contentType: {
        DataType: 'String',
        StringValue: message.contentType,
      },
    },
  })

  try {
    const response = await sqsClient.send(command)
    console.log('✅ Mensagem enviada para SQS:', response.MessageId)
  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem para SQS:', error)
    throw new Error(`Falha ao enfileirar processamento: ${error.message}`)
  }
}


require('dotenv').config()
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs')
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const ffmpeg = require('fluent-ffmpeg')
const { writeFile, readFile, unlink } = require('fs/promises')
const { join } = require('path')
const { tmpdir } = require('os')
const https = require('https')
const http = require('http')

// Importar fetch (Node.js 18+ tem nativo, senão usar node-fetch)
let fetch
try {
  if (globalThis.fetch) {
    fetch = globalThis.fetch
  } else {
    fetch = require('node-fetch')
  }
} catch {
  // Fallback para Node.js < 18
  fetch = require('node-fetch')
}

// Configuração AWS
const AWS_REGION = process.env.AWS_REGION || 'us-east-2'
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'brasilpsd-arquivos'
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SQS_QUEUE_URL) {
  console.error('❌ SQS_QUEUE_URL não configurado')
  process.exit(1)
}

const sqsClient = new SQSClient({ region: AWS_REGION })
const s3Client = new S3Client({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

// Função para baixar arquivo do S3
async function downloadFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key
  })
  
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  
  return new Promise((resolve, reject) => {
    const protocol = signedUrl.startsWith('https') ? https : http
    protocol.get(signedUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }
      
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    }).on('error', reject)
  })
}

// Função para fazer upload para S3
// Retorna apenas a key (não a URL completa), pois o frontend usa getS3Url() que pode usar CloudFront se configurado
async function uploadToS3(buffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  })
  
  await s3Client.send(command)
  
  // Retornar apenas a key (não a URL completa)
  // O frontend usa getS3Url() que pode usar CloudFront se configurado
  return key
}

// Função para converter vídeo para MP4
async function convertToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-profile:v main',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-crf 23',
        '-an' // Remover áudio
      ])
      .format('mp4')
      .output(outputPath)
      .on('start', (cmd) => console.log('🎬 FFmpeg:', cmd))
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`⏳ Progress: ${Math.round(progress.percent)}%`)
        }
      })
      .on('end', () => {
        console.log('✅ Conversão concluída')
        resolve()
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err.message)
        reject(err)
      })
      .run()
  })
}

// Função para gerar preview leve (metade do vídeo, otimizado)
async function generatePreview(inputPath, outputPath, duration) {
  const previewDuration = duration ? Math.min(duration / 2, 30) : 30 // Máximo 30 segundos, fallback 30s
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setDuration(previewDuration)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-profile:v main',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-crf 28', // Qualidade um pouco menor para arquivo menor
        '-vf scale=1280:-2', // Redimensionar para largura máxima de 1280px
        '-an' // Remover áudio
      ])
      .format('mp4')
      .output(outputPath)
      .on('start', (cmd) => console.log('🎬 FFmpeg Preview:', cmd))
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`⏳ Preview Progress: ${Math.round(progress.percent)}%`)
        }
      })
      .on('end', () => {
        console.log('✅ Preview gerado')
        resolve()
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg preview error:', err.message)
        reject(err)
      })
      .run()
  })
}

// Função para extrair metadados do vídeo
async function extractMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio')
      
      resolve({
        width: videoStream?.width,
        height: videoStream?.height,
        duration: metadata.format?.duration ? parseFloat(metadata.format.duration) : null,
        frameRate: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : null,
        codec: videoStream?.codec_name,
        colorSpace: videoStream?.color_space,
        audioCodec: audioStream?.codec_name
      })
    })
  })
}

// Função para extrair thumbnail
async function extractThumbnail(inputPath, outputPath) {
  const path = require('path')
  const fs = require('fs')
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['50%'], // Meio do vídeo
        filename: 'thumb.jpg',
        folder: path.dirname(outputPath),
        size: '1280x720'
      })
      .on('end', () => {
        // Mover arquivo para o path correto
        const tempPath = join(path.dirname(outputPath), 'thumb.jpg')
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, outputPath)
          console.log('✅ Thumbnail extraído')
          resolve()
        } else {
          reject(new Error('Thumbnail não foi gerado'))
        }
      })
      .on('error', (err) => {
        console.error('❌ Thumbnail error:', err.message)
        reject(err)
      })
  })
}

// Função para atualizar banco de dados via Supabase
async function updateDatabase(resourceId, data) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Supabase não configurado, pulando atualização do banco')
    return
  }
  
  // Salvar apenas as keys (não URLs completas) no banco
  // O frontend usa getS3Url() que pode usar CloudFront se configurado
  const updateData = {
    file_url: data.fileUrl, // Já é apenas a key
    preview_url: data.previewUrl, // Já é apenas a key
    thumbnail_url: data.thumbnailUrl, // Já é apenas a key
    file_format: 'mp4',
    width: data.metadata?.width,
    height: data.metadata?.height,
    duration: data.metadata?.duration ? Math.round(data.metadata.duration) : null,
    frame_rate: data.metadata?.frameRate,
    video_encoding: data.metadata?.codec,
    video_color_space: data.metadata?.colorSpace,
    video_audio_codec: data.metadata?.audioCodec
  }
  
  // Remover campos null/undefined
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === null || updateData[key] === undefined) {
      delete updateData[key]
    }
  })
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${resourceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(updateData)
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Supabase update failed: ${error}`)
    }
    
    console.log('✅ Banco de dados atualizado')
  } catch (error) {
    console.error('❌ Erro ao atualizar banco:', error.message)
    throw error
  }
}

// Função principal de processamento
async function processVideo(message) {
  const { resourceId, key, userId, fileName, contentType } = JSON.parse(message.Body)
  
  console.log('🔄 Processando vídeo:', { resourceId, key, fileName })
  
  const tempDir = tmpdir()
  const originalPath = join(tempDir, `original-${Date.now()}.${fileName.split('.').pop()}`)
  const mp4Path = join(tempDir, `converted-${Date.now()}.mp4`)
  const previewPath = join(tempDir, `preview-${Date.now()}.mp4`)
  const thumbnailPath = join(tempDir, `thumb-${Date.now()}.jpg`)
  
  try {
    // 1. Baixar arquivo original do S3
    console.log('⬇️ Baixando arquivo do S3...')
    const originalBuffer = await downloadFromS3(key)
    await writeFile(originalPath, originalBuffer)
    console.log('✅ Arquivo baixado:', originalBuffer.length, 'bytes')
    
    // 2. Extrair metadados do original
    console.log('📊 Extraindo metadados...')
    const metadata = await extractMetadata(originalPath)
    console.log('✅ Metadados:', metadata)
    
    // 3. Converter para MP4
    console.log('🎬 Convertendo para MP4...')
    await convertToMp4(originalPath, mp4Path)
    const mp4Buffer = await readFile(mp4Path)
    console.log('✅ MP4 convertido:', mp4Buffer.length, 'bytes')
    
    // 4. Upload MP4 para resources/
    const mp4FileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
    const mp4Key = `resources/${userId}/${mp4FileName}`
    const mp4KeyResult = await uploadToS3(mp4Buffer, mp4Key, 'video/mp4')
    console.log('✅ MP4 enviado para S3 (key):', mp4KeyResult)
    
    // 5. Gerar preview leve e thumbnail
    let previewKey = null
    let thumbnailKey = null
    
    try {
      console.log('🎬 Gerando preview...')
      await generatePreview(mp4Path, previewPath, metadata.duration || 60)
      const previewBuffer = await readFile(previewPath)
      console.log('✅ Preview gerado:', previewBuffer.length, 'bytes')
      
      // 6. Upload preview para video-previews/
      const previewFileName = `video-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
      const previewKeyPath = `video-previews/${userId}/${previewFileName}`
      previewKey = await uploadToS3(previewBuffer, previewKeyPath, 'video/mp4')
      console.log('✅ Preview enviado para S3 (key):', previewKey)
      
      // 7. Extrair thumbnail
      console.log('🖼️ Extraindo thumbnail...')
      await extractThumbnail(mp4Path, thumbnailPath)
      const thumbnailBuffer = await readFile(thumbnailPath)
      console.log('✅ Thumbnail extraído:', thumbnailBuffer.length, 'bytes')
      
      // 8. Upload thumbnail para thumbnails/
      const thumbnailFileName = `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
      const thumbnailKeyPath = `thumbnails/${userId}/${thumbnailFileName}`
      thumbnailKey = await uploadToS3(thumbnailBuffer, thumbnailKeyPath, 'image/jpeg')
      console.log('✅ Thumbnail enviado para S3 (key):', thumbnailKey)
    } catch (previewError) {
      console.error('⚠️ Erro ao gerar preview/thumbnail (continuando):', previewError.message)
      // Continuar mesmo se preview falhar
    }
    
    // 9. Deletar arquivo original temporário do S3 (está em resources/ sem userId)
    console.log('🗑️ Deletando arquivo original temporário do S3...')
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKET_NAME,
        Key: key
      })
      await s3Client.send(deleteCommand)
      console.log('✅ Arquivo original temporário deletado do S3')
    } catch (deleteError) {
      console.warn('⚠️ Erro ao deletar arquivo original (não crítico):', deleteError.message)
    }
    
    // 10. Atualizar banco de dados
    console.log('💾 Atualizando banco de dados...')
    await updateDatabase(resourceId, {
      fileUrl: mp4KeyResult, // Key do MP4
      previewUrl: previewKey, // Key do preview
      thumbnailUrl: thumbnailKey, // Key do thumbnail
      metadata: metadata
    })
    
    // Limpar arquivos temporários locais
    await Promise.all([
      unlink(originalPath).catch(() => {}),
      unlink(mp4Path).catch(() => {}),
      unlink(previewPath).catch(() => {}),
      unlink(thumbnailPath).catch(() => {})
    ])
    
    console.log('✅ Processamento concluído com sucesso!')
    return true
  } catch (error) {
    console.error('❌ Erro no processamento:', error)
    
    // Limpar arquivos temporários em caso de erro
    await Promise.all([
      unlink(originalPath).catch(() => {}),
      unlink(mp4Path).catch(() => {}),
      unlink(previewPath).catch(() => {}),
      unlink(thumbnailPath).catch(() => {})
    ])
    
    throw error
  }
}

// Loop principal do worker
async function pollQueue() {
  console.log('🔄 Polling SQS queue...')
  
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 300 // 5 minutos
    })
    
    const response = await sqsClient.send(command)
    
    if (response.Messages && response.Messages.length > 0) {
      const message = response.Messages[0]
      console.log('📨 Mensagem recebida:', message.MessageId)
      
      try {
        await processVideo(message)
        
        // Deletar mensagem da fila após processamento bem-sucedido
        const deleteCommand = new DeleteMessageCommand({
          QueueUrl: SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle
        })
        await sqsClient.send(deleteCommand)
        console.log('✅ Mensagem processada e removida da fila')
      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error)
        // Mensagem ficará visível novamente após VisibilityTimeout
        // SQS tentará novamente automaticamente
      }
    }
  } catch (error) {
    console.error('❌ Erro ao receber mensagem:', error)
  }
  
  // Continuar polling
  setTimeout(pollQueue, 1000)
}

// Iniciar worker
console.log('🚀 Worker iniciado')
console.log('📋 Configuração:', {
  region: AWS_REGION,
  bucket: AWS_S3_BUCKET_NAME,
  queue: SQS_QUEUE_URL
})

pollQueue()


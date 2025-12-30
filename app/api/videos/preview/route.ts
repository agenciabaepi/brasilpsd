import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSignedS3Url, uploadToS3FromBuffer } from '@/lib/aws/s3'
import { extractS3Key } from '@/lib/aws/s3-utils'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Carrega ffmpeg dinamicamente para evitar falha de resolução em build
async function loadFfmpeg() {
  const [{ default: ffmpeg }, ffmpegPath, { Readable }] = await Promise.all([
    import('fluent-ffmpeg'),
    import('@ffmpeg-installer/ffmpeg'),
    import('stream'),
  ])
  ffmpeg.setFfmpegPath(ffmpegPath.path)
  return { ffmpeg, Readable }
}

// Helpers
const parseJson = async (req: Request) => {
  try {
    return await req.json()
  } catch {
    return null
  }
}

const bufferFromUrl = async (url: string): Promise<Buffer> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch source video: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

const transcodePreview = async (input: Buffer): Promise<{ preview: Buffer; poster: Buffer }> => {
  const { ffmpeg, Readable } = await loadFfmpeg()
  // Generate preview MP4 (mute, 540p max, CRF 30) and poster at 1s
  const previewPromise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    ffmpeg(Readable.from(input))
      .videoCodec('libx264')
      .noAudio()
      .size('?x540')
      .outputOptions([
        '-preset veryfast',
        '-crf 30',
        '-movflags +faststart',
      ])
      .format('mp4')
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on('data', (c) => chunks.push(c))
  })

  const posterPromise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    ffmpeg(Readable.from(input))
      .noAudio()
      .seekInput(1)
      .frames(1)
      .outputOptions(['-vf scale=?x540'])
      .format('image2')
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on('data', (c) => chunks.push(c))
  })

  const [preview, poster] = await Promise.all([previewPromise, posterPromise])
  return { preview, poster }
}

export async function POST(req: Request) {
  const body = await parseJson(req)
  if (!body || !body.resourceId) {
    return NextResponse.json({ error: 'resourceId is required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: resource, error } = await supabase
    .from('resources')
    .select('id, file_url, preview_url, thumbnail_url, creator_id, resource_type')
    .eq('id', body.resourceId)
    .single()

  if (error || !resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }

  if (resource.resource_type !== 'video') {
    return NextResponse.json({ error: 'Resource is not a video' }, { status: 400 })
  }

  // Fetch original video buffer
  const fileKey = extractS3Key(resource.file_url)
  if (!fileKey) {
    return NextResponse.json({ error: 'Invalid file_url' }, { status: 400 })
  }
  const fileSigned = await getSignedS3Url(fileKey, 300)
  const inputBuffer = await bufferFromUrl(fileSigned)

  // Transcode preview + poster
  const { preview, poster } = await transcodePreview(inputBuffer)

  // Upload preview and poster
  // Salvar na pasta correta: video-previews/{creator_id}/video-preview-{timestamp}-{rand}.mp4
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(7)
  const previewPath = `video-previews/${resource.creator_id}/video-preview-${timestamp}-${randomId}.mp4`
  const posterPath = `video-previews/${resource.creator_id}/video-preview-${timestamp}-${randomId}.jpg`

  const [previewUpload, posterUpload] = await Promise.all([
    uploadToS3FromBuffer(preview, previewPath, 'video/mp4'),
    uploadToS3FromBuffer(poster, posterPath, 'image/jpeg'),
  ])

  // Update resource
  const { error: updateErr, data: updated } = await supabase
    .from('resources')
    .update({
      preview_url: previewUpload.publicUrl,
      thumbnail_url: posterUpload.publicUrl,
    })
    .eq('id', resource.id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 })
  }

  return NextResponse.json({
    preview_url: updated.preview_url,
    thumbnail_url: updated.thumbnail_url,
  })
}


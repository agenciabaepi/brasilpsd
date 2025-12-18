import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/aws/s3'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { resourceId, key } = await request.json()

    if (!resourceId || !key) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Verify resource exists and is approved
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, status')
      .eq('id', resourceId)
      .single()

    if (resourceError || !resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    if (resource.status !== 'approved') {
      // Allow creator to download their own resources
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Resource not available' }, { status: 403 })
      }
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = await getSignedDownloadUrl(key, 3600)

    return NextResponse.json({ url: signedUrl })
  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}


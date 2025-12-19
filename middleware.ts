import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Protect creator dashboard routes (but allow public creator profiles)
  // Public profile route: /creator/[id] (handled by (main) route group)
  // Protected routes: /creator (dashboard), /creator/upload, /creator/resources, etc.
  const creatorPath = req.nextUrl.pathname
  
  // Check if this is exactly /creator (dashboard) or starts with a protected sub-route
  const isProtectedRoute = 
    creatorPath === '/creator' || // Exact match for dashboard
    creatorPath.startsWith('/creator/upload') ||
    creatorPath.startsWith('/creator/resources') ||
    creatorPath.startsWith('/creator/earnings') ||
    creatorPath.startsWith('/creator/profile')
  
  // If it's NOT a protected route (i.e., it's a public profile like /creator/[uuid]), allow access
  if (creatorPath.startsWith('/creator') && !isProtectedRoute) {
    // This is a public creator profile - allow access without authentication
    return res
  }
  
  // Otherwise, protect creator dashboard routes
  if (isProtectedRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_creator && !profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard') || 
      req.nextUrl.pathname.startsWith('/favorites')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/creator/:path*',
    '/dashboard/:path*',
    '/favorites/:path*',
  ],
}


import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Atualizar a sessão se necessário
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Protect creator dashboard routes (but allow public creator profiles)
  const creatorPath = req.nextUrl.pathname
  
  // Check if this is exactly /creator (dashboard) or starts with a protected sub-route
  const isProtectedRoute = 
    creatorPath === '/creator' || // Exact match for dashboard
    creatorPath.startsWith('/creator/upload') ||
    creatorPath.startsWith('/creator/resources') ||
    creatorPath.startsWith('/creator/collections') ||
    creatorPath.startsWith('/creator/earnings') ||
    creatorPath.startsWith('/creator/profile')
  
  // If it's NOT a protected route (i.e., it's a public profile like /creator/[uuid]), allow access
  if (creatorPath.startsWith('/creator') && !isProtectedRoute) {
    // This is a public creator profile - allow access without authentication
    return response
  }
  
  // Otherwise, protect creator dashboard routes
  if (isProtectedRoute) {
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_creator && !profile?.is_admin) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard') || 
      req.nextUrl.pathname.startsWith('/favorites')) {
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/creator/:path*',
    '/dashboard/:path*',
    '/favorites/:path*',
    '/collections/:path*',
  ],
}

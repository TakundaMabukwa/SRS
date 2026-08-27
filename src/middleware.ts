import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'

// Cache user sessions to reduce auth calls (30 second TTL)
const userCache = new Map<string, { user: any; role: string; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 1000;

const roles = [
  {
    name: 'admin',
    path: ['*'], // Admin has access to all routes
  },
  {
    name: 'call centre',
    path: ['*'], // All users have access to all routes
  },
  {
    name: 'fc',
    path: ['*'], // All users have access to all routes
  },
  {
    name: 'fleet manager',
    path: ['*'], // All users have access to all routes
  },
  {
    name: 'customer',
    path: ['*'], // All users have access to all routes
  },
  {
    name: 'cost centre',
    path: ['*'], // All users have access to all routes
  },
]

const publicRoutes = ['/login', '/signup', '/', '/logout', '/register',
  '/register/company', '/register/workshop',
  '/register/workshop/jobCard', '/register/onboarding',
  '/register/success', '/register/workshop/success',
  '/register/workshop/fileUpload']

function getAllowedPaths(role: string): string[] {
  const roleConfig = roles.find(r => r.name === role)
  if (roleConfig?.path.includes('*')) {
    return ['*'] // Admin has access to all paths
  }
  return roleConfig?.path || []
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isApiRoute = path.startsWith('/api/')

  // Logout
  if (req.nextUrl.pathname === '/logout') {
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
  }

  const accessToken = req.cookies.get('access_token')?.value
  const isAuthenticated = !!accessToken
  const isPublicRoute = publicRoutes.includes(path)

  // API routes: return 401 JSON instead of redirect
  if (isApiRoute && !isAuthenticated) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Page routes: redirect to login
  if (!isAuthenticated && !isPublicRoute && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isAuthenticated) {
    try {
      // Check cache first
      const cached = userCache.get(accessToken);
      if (cached && Date.now() < cached.expiresAt) {
        const role = cached.role;
        const allowedPaths = getAllowedPaths(role);
        const isAllowed = allowedPaths.includes('*') || allowedPaths.some(p => path.startsWith(p));
        if (!isAllowed) {
          if (isApiRoute) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
          }
          return NextResponse.redirect(new URL('/login', req.url))
        }
        return NextResponse.next();
      }

      const supabase = createMiddlewareClient(req)
      const { data: { user }, error } = await supabase.auth.getUser()

      const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", (user?.id) as string)
        .single();

      if (error || userError) {
        if (isApiRoute) {
          return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', req.url))
      }

      if (user) {
        const role = decodeURIComponent(userRecord?.role || '')
        // Cache the user session
        userCache.set(accessToken, { user, role, expiresAt: Date.now() + CACHE_TTL_MS });
        if (role) {
          const allowedPaths = getAllowedPaths(role)
          const isAllowed = allowedPaths.includes('*') || allowedPaths.some(p => path.startsWith(p))
          if (!isAllowed) {
            if (isApiRoute) {
              return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
            }
            return NextResponse.redirect(new URL('/login', req.url))
          }
        } else {
          if (isApiRoute) {
            return NextResponse.json({ success: false, message: 'No role assigned' }, { status: 403 })
          }
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }
    } catch (error) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, message: 'Auth error' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|woff|woff2|ttf|eot)).*)'
  ],
}

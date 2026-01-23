import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Public routes that don't require authentication
    const publicRoutes = ['/', '/pricing', '/login']
    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/api/subscriptions')

    // If on public route, allow access
    if (isPublicRoute) {
      return NextResponse.next()
    }

    // If no token and not on public route, redirect to login
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Check RBAC
    const userRole = token.role as string

    // Employees cannot access /employees
    if (pathname.startsWith('/employees') && userRole === 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        // Public routes that don't require authentication
        const publicRoutes = ['/', '/pricing', '/login']
        const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/api/subscriptions')
        
        // Allow access to public routes without token
        if (isPublicRoute) {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}


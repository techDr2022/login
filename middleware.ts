import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Public routes that don't require authentication
    const publicRoutes = ['/', '/pricing', '/login', '/client-login']
    const isPublicRoute =
      publicRoutes.includes(pathname) ||
      pathname.startsWith('/api/subscriptions') ||
      pathname.startsWith('/api/cron') ||
      pathname.startsWith('/api/extension') ||
      pathname.startsWith('/board')

    // If on public route, allow access
    if (isPublicRoute) {
      const response = NextResponse.next()
      if (pathname.startsWith('/board')) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow')
        response.headers.set('Refresh', '60')
      }
      return response
    }

    // If no token and not on public route, redirect to login
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Check RBAC
    const userRole = token.role as string

    if (userRole === 'CLIENT') {
      const portalPage = pathname === '/portal' || pathname.startsWith('/portal/')
      const portalReport = pathname === '/api/portal/report'
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && !portalReport) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!pathname.startsWith('/api/') && !portalPage && pathname !== '/login') {
        return NextResponse.redirect(new URL('/portal', req.url))
      }
    }

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
        const publicRoutes = ['/', '/pricing', '/login', '/client-login']
        const isPublicRoute =
          publicRoutes.includes(pathname) ||
          pathname.startsWith('/api/subscriptions') ||
          pathname.startsWith('/api/cron') ||
          pathname.startsWith('/api/extension') ||
          pathname.startsWith('/board')
        
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
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|notification-sw.js|techdr-notification.svg|techdr-notification.png|api/webhooks).*)'],
}


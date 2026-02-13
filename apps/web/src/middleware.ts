import { withAuth } from "next-auth/middleware"
import { NextResponse, type NextRequest } from "next/server"

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true')

const authMiddleware = withAuth(
  function middleware(_req: NextRequest) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    }
  }
)

export default authBypassEnabled
  ? function middleware(_req: NextRequest) {
      return NextResponse.next()
    }
  : authMiddleware

// Protect all routes except public ones
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /auth/* (authentication pages)
     * - /api/auth/* (NextAuth API routes)
     * - /api/trpc/* (tRPC API routes - has own auth via protectedProcedure)
     * - /api/health and /api/health/* (health check endpoints for K8s probes)
     * - /api/webhooks/* (webhook endpoints from external services)
     * - /api/db/* (database management endpoints - protected by their own auth)
     * - /api/apps/sync (app sync endpoint - protected by its own auth)
     * - /api/resources/* (resources endpoints for testing)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    '/((?!auth|api/auth|api/trpc|api/health|api/webhooks|api/db|api/apps/sync|api/resources|api/integrations/org/.*/sync|api/integrations/k8s|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ]
}

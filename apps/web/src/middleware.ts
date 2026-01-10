import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
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
    '/((?!auth|api/auth|api/trpc|api/health|api/webhooks|api/db|api/apps/sync|api/resources|api/integrations/org/.*/sync|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ]
}

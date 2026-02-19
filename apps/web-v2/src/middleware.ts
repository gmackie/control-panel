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

export const config = {
  matcher: [
    '/((?!auth|api/auth|api/trpc|api/health|api/webhooks|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ]
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the code and state from GitHub OAuth
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  // Redirect to NextAuth callback with the parameters
  const nextAuthUrl = new URL('/api/auth/callback/github', request.nextUrl.origin);
  
  if (code) {
    nextAuthUrl.searchParams.set('code', code);
  }
  if (state) {
    nextAuthUrl.searchParams.set('state', state);
  }
  if (error) {
    nextAuthUrl.searchParams.set('error', error);
  }
  
  return NextResponse.redirect(nextAuthUrl);
}
import { NextRequest, NextResponse } from 'next/server';
import { GitHubOAuth } from '@/lib/auth/github-oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle errors from GitHub
  if (error) {
    return NextResponse.redirect(new URL('/auth/error?error=' + error, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/auth/error?error=missing_params', request.url));
  }

  try {
    // Use the expected redirect URI
    const redirectUri = 'https://gmac.io/oauth2/callback';
    
    // Authenticate with GitHub
    const authenticated = await GitHubOAuth.authenticate(code, state, redirectUri);
    
    if (!authenticated) {
      return NextResponse.redirect(new URL('/auth/error?error=unauthorized', request.url));
    }

    // Redirect to dashboard on success
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/auth/error?error=auth_failed', request.url));
  }
}
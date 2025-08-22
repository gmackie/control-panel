import { NextResponse } from 'next/server';

export async function GET() {
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  
  // Add required parameters
  githubAuthUrl.searchParams.set('client_id', process.env.GITHUB_ID!);
  githubAuthUrl.searchParams.set('redirect_uri', 'https://gmac.io/oauth2/callback');
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', 'test-state-123');
  
  const config = {
    message: 'OAuth Configuration Test',
    github_client_id: process.env.GITHUB_ID,
    expected_callback_url: 'https://gmac.io/oauth2/callback',
    nextauth_url: process.env.NEXTAUTH_URL,
    oauth_flow: {
      step1: 'User clicks sign in',
      step2: 'Redirect to GitHub with redirect_uri=https://gmac.io/oauth2/callback',
      step3: 'GitHub redirects back to https://gmac.io/oauth2/callback?code=xxx&state=yyy',
      step4: 'Our route handler redirects to /api/auth/callback/github?code=xxx&state=yyy',
      step5: 'NextAuth processes the callback and signs in the user'
    },
    test_auth_url: githubAuthUrl.toString(),
    troubleshooting: {
      check1: 'Ensure GitHub OAuth app callback URL is exactly: https://gmac.io/oauth2/callback',
      check2: 'Clear browser cookies and cache',
      check3: 'Try in incognito/private browsing mode',
      check4: 'Check browser console for errors'
    }
  };

  return NextResponse.json(config, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}
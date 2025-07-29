import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const callbackUrl = `${process.env.NEXTAUTH_URL}/oauth2/callback`;
  const standardCallbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback/github`;
  
  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    customCallbackUrl: callbackUrl,
    standardCallbackUrl: standardCallbackUrl,
    githubClientId: process.env.GITHUB_ID,
    note: "Make sure your GitHub OAuth app is configured with the customCallbackUrl"
  });
}
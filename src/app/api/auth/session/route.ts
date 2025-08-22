import { NextResponse } from 'next/server';
import { GitHubOAuth } from '@/lib/auth/github-oauth';

export async function GET() {
  try {
    const session = await GitHubOAuth.getSession();
    
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
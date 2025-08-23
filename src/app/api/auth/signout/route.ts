import { NextResponse } from 'next/server';
import { GitHubOAuth } from '@/lib/auth/github-oauth';

export async function POST() {
  try {
    await GitHubOAuth.signOut();
    return NextResponse.json({ success: true, message: 'Signed out successfully' });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
  }
}
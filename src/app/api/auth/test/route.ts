import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const config = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GITHUB_ID_EXISTS: !!process.env.GITHUB_ID,
    GITHUB_SECRET_EXISTS: !!process.env.GITHUB_SECRET,
    NEXTAUTH_SECRET_EXISTS: !!process.env.NEXTAUTH_SECRET,
    providers: authOptions.providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
    })),
    callbacks: {
      signIn: authOptions.callbacks?.signIn ? 'configured' : 'not configured',
      jwt: authOptions.callbacks?.jwt ? 'configured' : 'not configured',
      session: authOptions.callbacks?.session ? 'configured' : 'not configured',
    },
    pages: authOptions.pages,
  };

  return NextResponse.json(config);
}
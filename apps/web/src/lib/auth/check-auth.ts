import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function checkAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    user: session.user,
    authenticated: true,
  };
}

export async function requireAuth() {
  const session = await checkAuth();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return session;
}

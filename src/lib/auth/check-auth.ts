import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function checkAuth() {
  const cookieStore = cookies();
  const authToken = cookieStore.get('auth-token');
  const githubUser = cookieStore.get('github-user');

  if (!authToken || !githubUser) {
    return null;
  }

  return {
    user: githubUser.value,
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
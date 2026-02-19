import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    authenticated: status === 'authenticated',
    loading: status === 'loading',
    signOut: () => nextAuthSignOut({ callbackUrl: '/auth/signin' }),
  };
}
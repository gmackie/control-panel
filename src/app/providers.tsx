"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, createContext, useContext, useEffect } from "react";
import { NotificationProvider } from "@/components/notifications/notification-system";

interface AuthContextType {
  user: string | null;
  authenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authenticated: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchInterval: 30 * 1000, // 30 seconds
          },
        },
      })
  );

  const [auth, setAuth] = useState<{ user: string | null; authenticated: boolean }>({
    user: null,
    authenticated: false,
  });

  useEffect(() => {
    // Check auth status on mount
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(session => {
        if (session?.authenticated) {
          setAuth({ user: session.user, authenticated: true });
        }
      })
      .catch(() => {});
  }, []);

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setAuth({ user: null, authenticated: false });
    window.location.href = '/auth/signin';
  };

  return (
    <AuthContext.Provider value={{ ...auth, signOut }}>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </NotificationProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}

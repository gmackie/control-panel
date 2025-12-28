"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { NotificationProvider } from "@/components/notifications/notification-system";
import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts/KeyboardShortcutsProvider";

// Export useAuth for compatibility
export { useAuth } from "@/hooks/useAuth";

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

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <CommandPaletteProvider>
            <KeyboardShortcutsProvider>
              {children}
            </KeyboardShortcutsProvider>
          </CommandPaletteProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </NotificationProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
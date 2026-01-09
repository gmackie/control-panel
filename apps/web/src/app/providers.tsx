"use client";

import { SessionProvider } from "next-auth/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { NotificationProvider } from "@/components/notifications/notification-system";
import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts/KeyboardShortcutsProvider";
import { TRPCProvider } from "@/lib/trpc/provider";

export { useAuth } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>
        <NotificationProvider>
          <CommandPaletteProvider>
            <KeyboardShortcutsProvider>
              {children}
            </KeyboardShortcutsProvider>
          </CommandPaletteProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </NotificationProvider>
      </TRPCProvider>
    </SessionProvider>
  );
}
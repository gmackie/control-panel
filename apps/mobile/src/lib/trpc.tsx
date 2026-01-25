import React, { useState, useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@repo/api";
import { getApiKey } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_API_URL = "https://control.gmac.io";

function getApiUrlSafe(): string {
  try {
    const state = useSettingsStore.getState();
    if (!state || !state.apiEnvironment) {
      return DEFAULT_API_URL;
    }
    const urls: Record<string, string> = {
      production: "https://control.gmac.io",
      local: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    };
    return urls[state.apiEnvironment] || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

function createTrpcClient(apiUrl: string) {
  const trpcUrl = `${apiUrl}/api/trpc`;
  console.log("[tRPC] Creating client for:", trpcUrl);

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        headers() {
          const apiKey = getApiKey();
          if (apiKey) {
            return { Authorization: `Bearer ${apiKey}` };
          }
          return {};
        },
      }),
    ],
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const apiEnvironment = useSettingsStore((s) => s.apiEnvironment);
  const [clientVersion, setClientVersion] = useState(0);

  useEffect(() => {
    console.log("[tRPC] Environment changed:", apiEnvironment);
    queryClient.clear();
    setClientVersion((v) => v + 1);
  }, [apiEnvironment]);

  const trpcClient = useMemo(() => {
    const url = getApiUrlSafe();
    console.log("[tRPC] Creating client, version:", clientVersion, "url:", url);
    return createTrpcClient(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientVersion]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

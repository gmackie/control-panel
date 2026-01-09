import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact, httpBatchLink, type CreateTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@repo/api";
import { useAuthStore, getApiKey } from "../stores/auth";

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

function getApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  
  if (url) {
    console.log("[tRPC] Using API URL:", url);
    return url;
  }
  
  console.warn("[tRPC] No EXPO_PUBLIC_API_URL set, using localhost");
  return "http://localhost:3000";
}

function createTrpcClient() {
  const apiUrl = getApiUrl();
  const trpcUrl = `${apiUrl}/api/trpc`;
  console.log("[tRPC] Creating client for:", trpcUrl);
  
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        headers: () => {
          const apiKey = getApiKey();
          if (apiKey) {
            return { Authorization: `Bearer ${apiKey}` };
          }
          return {};
        },
        fetch: async (url, options) => {
          console.log("[tRPC] Fetching:", url);
          try {
            const response = await fetch(url, options);
            console.log("[tRPC] Response status:", response.status);
            return response;
          } catch (error) {
            console.error("[tRPC] Fetch error:", error);
            throw error;
          }
        },
      }),
    ],
  });
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const apiKey = useAuthStore((s) => s.apiKey);
  
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
          },
        },
      })
  );

  const [trpcClient, setTrpcClient] = useState(() => createTrpcClient());

  useEffect(() => {
    console.log("[tRPC] API key changed, recreating client");
    setTrpcClient(createTrpcClient());
    queryClient.clear();
  }, [apiKey, queryClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

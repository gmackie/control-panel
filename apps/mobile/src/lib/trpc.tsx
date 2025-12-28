/**
 * tRPC Client for React Native
 * 
 * Sets up tRPC client with TanStack Query for the mobile app
 */

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact, httpBatchLink, type CreateTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@repo/api";

// Create tRPC React hooks with explicit type
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

// Get the API URL from environment
function getApiUrl(): string {
  // In development, use local URL
  // In production, use the deployed API URL
  const url = process.env.EXPO_PUBLIC_API_URL;
  
  // Log the URL for debugging
  console.log("[tRPC] EXPO_PUBLIC_API_URL:", url);
  
  if (url) return url;
  
  // Default to localhost for development
  // Note: Use your machine's IP when testing on physical device
  // localhost won't work on physical devices - need the machine's IP
  console.warn("[tRPC] No EXPO_PUBLIC_API_URL set, using localhost (won't work on physical devices)");
  return "http://localhost:3000";
}

/**
 * tRPC Provider Component
 * 
 * Wraps the app with QueryClient and tRPC client
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            gcTime: 5 * 60 * 1000, // 5 minutes (previously cacheTime)
          },
        },
      })
  );

  const [trpcClient] = useState(() => {
    const apiUrl = getApiUrl();
    const trpcUrl = `${apiUrl}/api/trpc`;
    console.log("[tRPC] Connecting to:", trpcUrl);
    
    return trpc.createClient({
      links: [
        httpBatchLink({
          url: trpcUrl,
          transformer: superjson,
          // Optional: Add authentication headers
          // headers: async () => {
          //   const token = await getAuthToken();
          //   return {
          //     Authorization: token ? `Bearer ${token}` : '',
          //   };
          // },
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
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * tRPC API Route Handler
 * 
 * Exposes the tRPC router as Next.js API routes
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@repo/api";

/**
 * Handle tRPC requests
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      // Get auth from request headers
      // In a real app, you'd verify the session/token here
      const authHeader = req.headers.get("authorization");
      let userId: string | null = null;

      if (authHeader?.startsWith("Bearer ")) {
        // For bearer token auth (mobile)
        // Verify token and extract userId
        // userId = await verifyToken(authHeader.slice(7));
      }

      // For cookie-based auth (web), you'd use NextAuth session
      // const session = await getServerSession(authOptions);
      // userId = session?.user?.id || null;

      return createContext({
        headers: req.headers,
        userId,
      });
    },
    onError: ({ error, path }) => {
      console.error(`tRPC error on ${path}:`, error);
    },
  });

export { handler as GET, handler as POST };

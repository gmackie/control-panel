import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { TRPCError } from "@trpc/server";
import { appRouter, createContext } from "@repo/api";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      return createContext({
        headers: req.headers,
      });
    },
    onError: ({ error, path }: { error: TRPCError; path?: string }) => {
      console.error(`tRPC error on ${path ?? "unknown"}:`, error);
    },
  });

export { handler as GET, handler as POST };

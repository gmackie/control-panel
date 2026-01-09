import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { TRPCError } from "@trpc/server";
import { getServerSession } from "next-auth";
import { appRouter, createContext } from "@repo/api";
import { authOptions } from "@/lib/auth";

const handler = async (req: Request) => {
  const session = await getServerSession(authOptions);
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      return createContext({
        headers: req.headers,
        userId: session?.user?.id ?? null,
      });
    },
    onError: ({ error, path }: { error: TRPCError; path?: string }) => {
      console.error(`tRPC error on ${path ?? "unknown"}:`, error);
    },
  });
};

export { handler as GET, handler as POST };

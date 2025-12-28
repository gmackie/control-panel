/**
 * tRPC Setup
 * 
 * Base tRPC configuration with procedures
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: null,
      cause: error.cause,
    },
  }),
});

// Export reusable router and procedure helpers
export const router = t.router;
export const middleware = t.middleware;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Auth middleware - checks for valid user
 */
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

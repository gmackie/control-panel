/**
 * tRPC Server-side Utilities
 * 
 * For calling tRPC procedures from server components
 */

import { appRouter, createContext } from "@repo/api";

/**
 * Create a server-side tRPC caller
 * 
 * Usage in Server Components:
 * const caller = await createServerCaller();
 * const notifications = await caller.notifications.list({});
 */
export async function createServerCaller() {
  const ctx = await createContext({
    headers: new Headers(),
    userId: null, // Would be populated from session in real app
  });

  return appRouter.createCaller(ctx);
}

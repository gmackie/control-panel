/**
 * tRPC Context
 * 
 * Creates the context that's available to all procedures
 */

import { getDbAsync, type Database } from "@repo/db";

export interface Context {
  db: Database | null;
  userId: string | null;
  headers: Headers;
}

interface CreateContextOptions {
  headers: Headers;
  userId?: string | null;
}

/**
 * Create tRPC context
 * 
 * This is called for every request and provides the context to procedures.
 * Both web (cookie auth) and mobile (bearer token) auth are handled in the caller.
 */
export async function createContext({ 
  headers, 
  userId = null 
}: CreateContextOptions): Promise<Context> {
  const db = await getDbAsync();
  
  return {
    db,
    userId,
    headers,
  };
}

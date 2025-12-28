/**
 * Database Client
 * 
 * Turso/LibSQL connection setup
 */

import { createClient } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Type for the database instance
export type Database = LibSQLDatabase<typeof schema>;

// Singleton database instance
let dbInstance: Database | null = null;

/**
 * Get database URL from environment
 */
function getDatabaseUrl(): string {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }
  return url;
}

/**
 * Get auth token from environment
 */
function getAuthToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN;
}

/**
 * Initialize the database client
 */
function initializeDb(): Database {
  const client = createClient({
    url: getDatabaseUrl(),
    authToken: getAuthToken(),
  });
  
  return drizzle(client, { schema });
}

/**
 * Get the database instance (synchronous)
 * Throws if database is not initialized
 */
export function getDb(): Database {
  if (!dbInstance) {
    dbInstance = initializeDb();
  }
  return dbInstance;
}

/**
 * Get the database instance (async-safe)
 * Returns null if database cannot be initialized
 */
export async function getDbAsync(): Promise<Database | null> {
  try {
    if (!dbInstance) {
      dbInstance = initializeDb();
    }
    return dbInstance;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    return null;
  }
}

/**
 * Export the database instance for direct use
 * This will be initialized on first import
 */
export const db = (() => {
  try {
    return initializeDb();
  } catch {
    // Return null if env vars not set (during build)
    return null as unknown as Database;
  }
})();

/**
 * Database Client
 * 
 * Neon/PostgreSQL connection setup
 */

import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Type for the database instance
export type Database = NeonHttpDatabase<typeof schema>;

// Singleton database instance
let dbInstance: Database | null = null;

/**
 * Get database URL from environment
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or NEON_DATABASE_URL is not set");
  }
  return url;
}

/**
 * Initialize the database client
 */
function initializeDb(): Database {
  const sql = neon(getDatabaseUrl());
  return drizzle(sql, { schema });
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

/**
 * Database connection module
 * Uses Neon PostgreSQL with serverless driver
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@repo/db";

// Type for database instance
type Database = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: Database | null = null;

// Get database URL from environment
const getDatabaseUrl = (): string | null => {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL or NEON_DATABASE_URL not set");
    return null;
  }
  return url;
};

// Initialize database connection
const initDb = (): Database | null => {
  if (dbInstance) return dbInstance;
  
  const url = getDatabaseUrl();
  if (!url) return null;

  try {
    const sql = neon(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dbInstance = drizzle(sql as any, { schema });
    return dbInstance;
  } catch (error) {
    console.warn("Failed to create database client:", error);
    return null;
  }
};

// Export async database getter (for consistency with previous API)
export const getDbAsync = async (): Promise<Database | null> => {
  return initDb();
};

// Synchronous getter
export const getDb = (): Database | null => {
  return initDb();
};

// Direct db export - initializes on first access
export const db = (() => {
  try {
    return initDb();
  } catch {
    return null;
  }
})();

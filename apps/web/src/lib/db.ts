/**
 * Database connection module with lazy loading
 * Uses dynamic imports to avoid loading native libsql module at build time
 */

import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<any> | null = null;

// Async database initialization with dynamic imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initDbAsync = async (): Promise<any> => {
  if (dbInstance) return dbInstance;
  
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.warn("Database environment variables not available");
    return null;
  }

  try {
    // Dynamic imports to avoid loading native module at build time
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");
    
    client = createClient({
      url,
      authToken,
    });
    
    dbInstance = drizzle(client, { schema });
    return dbInstance;
  } catch (error) {
    console.warn("Failed to create database client:", error);
    return null;
  }
};

// Export async database getter (recommended)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDbAsync = async (): Promise<any> => {
  if (!initPromise) {
    initPromise = initDbAsync();
  }
  return initPromise;
};

// Synchronous getter - returns cached instance or null (for backward compat)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDb = (): any => {
  return dbInstance;
};

// For backward compatibility - always null at import time, use getDbAsync instead
export const db = null;

/**
 * PostgreSQL Database Connection Module
 * 
 * Uses node-postgres (pg) with Drizzle ORM
 * Connects to PostgreSQL running in the K3s cluster
 */

import * as schemaPg from "../schema-pg";

// Database instance cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<any> | null = null;

/**
 * Initialize PostgreSQL database connection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initDbAsync = async (): Promise<any> => {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.warn("DATABASE_URL or POSTGRES_URL environment variable not set");
    return null;
  }

  try {
    // Dynamic imports to avoid loading at build time
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");

    const pool = new Pool({
      connectionString,
      // Connection pool settings
      max: 10, // Maximum number of connections
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 5000, // Timeout connecting to the database
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    dbInstance = drizzle(pool, { schema: schemaPg });
    console.log("PostgreSQL connection established successfully");
    return dbInstance;
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    return null;
  }
};

/**
 * Get PostgreSQL database instance (async)
 * This is the recommended way to access the database
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPostgresDb = async (): Promise<any> => {
  if (!initPromise) {
    initPromise = initDbAsync();
  }
  return initPromise;
};

/**
 * Get PostgreSQL database instance (sync)
 * Returns cached instance or null if not initialized
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPostgresDbSync = (): any => {
  return dbInstance;
};

/**
 * Check if PostgreSQL is configured
 */
export const isPostgresConfigured = (): boolean => {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
};

/**
 * Health check for PostgreSQL connection
 */
export const checkPostgresHealth = async (): Promise<{
  healthy: boolean;
  message: string;
  latencyMs?: number;
}> => {
  const startTime = Date.now();

  try {
    const db = await getPostgresDb();
    if (!db) {
      return {
        healthy: false,
        message: "PostgreSQL not configured or connection failed",
      };
    }

    // Execute a simple query to check connection
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);

    return {
      healthy: true,
      message: "PostgreSQL connection healthy",
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `PostgreSQL health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      latencyMs: Date.now() - startTime,
    };
  }
};

// Export schema for use in other modules
export { schemaPg };

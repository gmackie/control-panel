import { createClient, Client } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;

const createDatabaseClient = (): Client | null => {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.warn("Database environment variables not available");
    return null;
  }

  try {
    return createClient({
      url,
      authToken,
    });
  } catch (error) {
    console.warn("Failed to create database client:", error);
    return null;
  }
};

// Initialize database connection
const initDb = (): LibSQLDatabase<typeof schema> | null => {
  if (dbInstance) return dbInstance;
  
  client = createDatabaseClient();
  if (!client) return null;
  
  dbInstance = drizzle(client, { schema });
  return dbInstance;
};

// Export the database instance (lazy initialization)
export const getDb = (): LibSQLDatabase<typeof schema> | null => {
  return initDb();
};

// For backward compatibility - returns null if not initialized
export const db = initDb();

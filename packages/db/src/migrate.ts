/**
 * Database Migration Script
 * 
 * Runs Drizzle migrations against the Turso database
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env.local
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

// Validate required environment variables
if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL is required");
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

async function main() {
  console.log("Running migrations...");

  try {
    await migrate(db, { migrationsFolder: resolve(__dirname, "../drizzle") });
    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();

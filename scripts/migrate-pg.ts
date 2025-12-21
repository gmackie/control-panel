/**
 * PostgreSQL Migration Script
 * 
 * Run with: npm run db:pg:migrate
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("Error: DATABASE_URL or POSTGRES_URL environment variable is required");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL...");

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("Connected to PostgreSQL successfully");

    const db = drizzle(pool);

    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: "./drizzle-pg" });

    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

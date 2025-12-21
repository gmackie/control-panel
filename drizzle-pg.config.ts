import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema-pg.ts",
  out: "./drizzle-pg",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  },
});

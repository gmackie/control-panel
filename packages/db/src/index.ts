/**
 * Database Package
 * 
 * Neon/PostgreSQL database client and schema exports
 */

export { db, getDb, getDbAsync, type Database } from "./client";
export * from "./schema";

// Re-export common drizzle-orm utilities to ensure version consistency
export { 
  eq, 
  ne, 
  gt, 
  gte, 
  lt, 
  lte, 
  and, 
  or, 
  not, 
  like, 
  ilike, 
  inArray, 
  sql,
  desc,
  asc,
  count,
  sum,
  avg,
  min,
  max,
} from "drizzle-orm";

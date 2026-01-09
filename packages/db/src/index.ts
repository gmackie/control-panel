/**
 * Database Package
 * 
 * Neon/PostgreSQL database client and schema exports
 */

export { db, getDb, getDbAsync, type Database } from "./client";
export * from "./schema";

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
  isNull,
  isNotNull,
  sql,
  desc,
  asc,
  count,
  sum,
  avg,
  min,
  max,
} from "drizzle-orm";

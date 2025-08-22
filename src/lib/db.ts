import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const createDatabaseClient = () => {
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

// Temporarily disable database for deployment
const client = null;
export const db = null;

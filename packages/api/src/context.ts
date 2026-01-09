import { getDbAsync, type Database } from "@repo/db";
import { validateApiKey } from "./lib/api-keys";

export interface Context {
  db: Database | null;
  userId: string | null;
  apiKeyId: string | null;
  permissions: string[];
  headers: Headers;
}

interface CreateContextOptions {
  headers: Headers;
  userId?: string | null;
}

export async function createContext({
  headers,
  userId = null,
}: CreateContextOptions): Promise<Context> {
  const db = await getDbAsync();

  let resolvedUserId = userId;
  let apiKeyId: string | null = null;
  let permissions: string[] = [];

  if (!resolvedUserId) {
    const authHeader = headers.get("authorization");
    if (authHeader?.startsWith("Bearer ") && db) {
      const token = authHeader.slice(7);
      const result = await validateApiKey(db, token);
      if (result.valid) {
        resolvedUserId = result.userId ?? null;
        apiKeyId = result.keyId ?? null;
        permissions = result.permissions ?? [];
      }
    }
  }

  return {
    db,
    userId: resolvedUserId,
    apiKeyId,
    permissions,
    headers,
  };
}

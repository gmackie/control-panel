import { randomBytes, createHash } from "crypto";
import { apiKeys, eq, and, isNull, type Database } from "@repo/db";

const API_KEY_PREFIX = "cp_";
const KEY_LENGTH = 32;

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(KEY_LENGTH).toString("base64url");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 12);

  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(
  db: Database,
  key: string
): Promise<{ valid: boolean; userId?: string; keyId?: string; permissions?: string[] }> {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return { valid: false };
  }

  const hash = hashApiKey(key);

  const result = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      permissions: apiKeys.permissions,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  const apiKey = result[0];
  if (!apiKey) {
    return { valid: false };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false };
  }

  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: apiKeys.usageCount,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKey.id));

  let permissions: string[] = [];
  try {
    permissions = JSON.parse(apiKey.permissions || "[]");
  } catch {
    permissions = [];
  }

  return {
    valid: true,
    userId: apiKey.userId,
    keyId: apiKey.id,
    permissions,
  };
}

export function parseExpiresIn(expiresIn: string): Date | null {
  const match = expiresIn.match(/^(\d+)(d|w|m|y)$/);
  if (!match || !match[1] || !match[2]) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  switch (unit) {
    case "d":
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    case "w":
      return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
    case "m":
      return new Date(now.setMonth(now.getMonth() + value));
    case "y":
      return new Date(now.setFullYear(now.getFullYear() + value));
    default:
      return null;
  }
}

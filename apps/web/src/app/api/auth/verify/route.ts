import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { apiKeys, users, eq, and, isNull } from "@repo/db";
import { createHash } from "crypto";

const API_KEY_PREFIX = "cp_";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization" },
        { status: 401 }
      );
    }

    const key = authHeader.slice(7);

    if (!key.startsWith(API_KEY_PREFIX)) {
      return NextResponse.json(
        { error: "Invalid key format" },
        { status: 401 }
      );
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const keyHash = hashApiKey(key);

    const result = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        userId: apiKeys.userId,
        permissions: apiKeys.permissions,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const apiKey = result[0];

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return NextResponse.json({ error: "API key expired" }, { status: 401 });
    }

    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, apiKey.id));

    const userResult = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, apiKey.userId))
      .limit(1);

    let permissions: string[] = [];
    try {
      permissions = JSON.parse(apiKey.permissions || "[]");
    } catch {
      permissions = [];
    }

    return NextResponse.json({
      valid: true,
      name: apiKey.name,
      permissions,
      user: userResult[0] || null,
    });
  } catch (error) {
    console.error("[Auth Verify] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

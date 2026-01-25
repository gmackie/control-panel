import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { apiKeys, users, eq, and, isNull } from "@repo/db";
import { createHash, randomBytes } from "crypto";

const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const ALLOWED_DOMAINS = ["gmacko.com", "gmac.io"];

const API_KEY_PREFIX = "cp_";

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(32).toString("base64url");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
}

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri, codeVerifier } = await request.json();

    if (!code || !redirectUri) {
      return NextResponse.json(
        { error: "Missing code or redirectUri" },
        { status: 400 }
      );
    }

    if (!AZURE_AD_CLIENT_ID || !AZURE_AD_CLIENT_SECRET || !AZURE_AD_TENANT_ID) {
      return NextResponse.json(
        { error: "OAuth not configured on server" },
        { status: 500 }
      );
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: AZURE_AD_CLIENT_ID,
      client_secret: AZURE_AD_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "openid profile email",
    });

    if (codeVerifier) {
      params.append("code_verifier", codeVerifier);
    }

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("[Mobile Auth] Token exchange failed:", err);
      return NextResponse.json(
        { error: "Token exchange failed" },
        { status: 401 }
      );
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userInfoResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get user info" },
        { status: 401 }
      );
    }

    const userInfo = await userInfoResponse.json();
    const email = userInfo.mail || userInfo.userPrincipalName;

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 401 });
    }

    const domain = email.toLowerCase().split("@")[1];
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: "Unauthorized domain" },
        { status: 403 }
      );
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    let userId: string;

    if (existingUsers.length === 0) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name: userInfo.displayName || email.split("@")[0],
          role: "user",
        })
        .returning({ id: users.id });
      userId = newUser.id;
    } else {
      userId = existingUsers[0].id;
    }

    const mobileKeyName = `mobile-${email.toLowerCase()}`;
    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.name, mobileKeyName),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (existingKey.length > 0) {
      await db
        .update(apiKeys)
        .set({
          revokedAt: new Date(),
          revokedReason: "Replaced by new mobile login",
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, existingKey[0].id));
    }

    const { key, hash, prefix } = generateApiKey();

    await db.insert(apiKeys).values({
      userId,
      name: mobileKeyName,
      description: `Mobile app API key for ${email}`,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: JSON.stringify(["read", "write"]),
    });

    return NextResponse.json({
      apiKey: key,
      user: {
        email,
        name: userInfo.displayName,
      },
    });
  } catch (error) {
    console.error("[Mobile Auth] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

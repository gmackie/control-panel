import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { apiKeys, users, eq, and, isNull } from "@repo/db";
import { createHash, randomBytes } from "crypto";
import { encode } from "next-auth/jwt";

const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const ALLOWED_DOMAINS = ["gmacko.com", "gmac.io"];
const API_KEY_PREFIX = "cp_";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

interface MobileAuthState {
  platform: "mobile";
  scheme: string;
  timestamp: number;
  nonce: string;
}

function decodeMobileState(encoded: string): MobileAuthState | null {
  try {
    const json = Buffer.from(encoded, "base64").toString("utf-8");
    const state = JSON.parse(json) as MobileAuthState;

    if (state.platform !== "mobile") return null;
    if (!state.scheme || !state.timestamp || !state.nonce) return null;

    const age = Date.now() - state.timestamp;
    if (age > STATE_MAX_AGE_MS) return null;

    return state;
  } catch {
    return null;
  }
}

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(32).toString("base64url");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stateParam = searchParams.get("state");
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const mobileState = stateParam ? decodeMobileState(stateParam) : null;
  const isMobile = !!mobileState;
  const scheme = mobileState?.scheme;

  const createErrorRedirect = (error: string) => {
    if (isMobile && scheme) {
      return NextResponse.redirect(`${scheme}://auth/callback?error=${encodeURIComponent(error)}`);
    }
    const url = new URL("/auth/error", request.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url);
  };

  if (errorParam) {
    return createErrorRedirect(errorDescription || errorParam);
  }

  if (!code) {
    return createErrorRedirect("No authorization code received");
  }

  if (!AZURE_AD_CLIENT_ID || !AZURE_AD_CLIENT_SECRET || !AZURE_AD_TENANT_ID) {
    return createErrorRedirect("OAuth not configured");
  }

  try {
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
    const callbackUrl = `${origin}/api/auth/callback/azure-ad`;
    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: AZURE_AD_CLIENT_ID,
        client_secret: AZURE_AD_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
        scope: "openid profile email",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error("[OAuth] Token exchange failed:", await tokenResponse.text());
      return createErrorRedirect("Authentication failed");
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return createErrorRedirect("Failed to get user info");
    }

    const userInfo = await userInfoResponse.json();
    const email = (userInfo.mail || userInfo.userPrincipalName)?.toLowerCase();

    if (!email) {
      return createErrorRedirect("No email in account");
    }

    const domain = email.split("@")[1];
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      return createErrorRedirect("Unauthorized domain");
    }

    const db = await getDbAsync();
    if (!db) {
      return createErrorRedirect("Database unavailable");
    }

    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;

    if (existingUsers.length === 0) {
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name: userInfo.displayName || email.split("@")[0],
          role: "user",
        })
        .returning({ id: users.id });
      userId = newUser.id;
    } else {
      userId = existingUsers[0].id;
    }

    if (isMobile && scheme) {
      const mobileKeyName = `mobile-${email}`;
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

      return NextResponse.redirect(
        `${scheme}://auth/callback?${new URLSearchParams({ apiKey: key, email })}`
      );
    }

    const sessionToken = await encode({
      token: {
        sub: userId,
        email: email,
        name: userInfo.displayName,
        provider: "azure-ad",
        accessToken: tokens.access_token,
      },
      secret: process.env.NEXTAUTH_SECRET!,
    });

    const response = NextResponse.redirect(new URL("/", request.url));

    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("[OAuth] Error:", error);
    return createErrorRedirect("Internal server error");
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

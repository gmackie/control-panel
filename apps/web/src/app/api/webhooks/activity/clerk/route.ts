/**
 * Clerk Webhook Handler for Activity Feed
 * 
 * Receives webhooks from Clerk and creates activity events
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { activityService } from "@/lib/activity/activity-service";
import { normalizeClerkUser, normalizeClerkSession } from "@/lib/activity/event-normalizers";
import { ClerkUserPayload, ClerkSessionPayload } from "@/lib/activity/types";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

/**
 * Verify Clerk webhook signature (Svix format)
 */
function verifyClerkSignature(
  payload: string, 
  svixId: string, 
  svixTimestamp: string, 
  svixSignature: string, 
  secret: string
): boolean {
  // Clerk uses Svix which has a specific signing format
  // The secret is base64 encoded and prefixed with "whsec_"
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
  
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");
  
  // Svix signature header contains multiple signatures separated by space
  // Format: "v1,signature1 v1,signature2"
  const signatures = svixSignature.split(" ").map(sig => sig.split(",")[1]);
  
  return signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sig, "base64"),
        Buffer.from(expectedSignature, "base64")
      );
    } catch {
      return false;
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    // Get the headers
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    const body = await request.text();
    let payload: ClerkUserPayload | ClerkSessionPayload;

    if (CLERK_WEBHOOK_SECRET && svixId && svixTimestamp && svixSignature) {
      // Verify the webhook signature
      const isValid = verifyClerkSignature(
        body, 
        svixId, 
        svixTimestamp, 
        svixSignature, 
        CLERK_WEBHOOK_SECRET
      );
      
      if (!isValid) {
        console.error("Clerk webhook verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    payload = JSON.parse(body);

    // Normalize and create activity event based on event type
    let activityEvent;

    if (payload.type.startsWith("user.")) {
      activityEvent = normalizeClerkUser(payload as ClerkUserPayload);
    } else if (payload.type.startsWith("session.")) {
      activityEvent = normalizeClerkSession(payload as ClerkSessionPayload);
    } else {
      // Unknown event type - log but don't fail
      console.log("Unknown Clerk event type:", payload.type);
      return NextResponse.json({ received: true, processed: false });
    }

    // Create the activity event
    await activityService.create(activityEvent);

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

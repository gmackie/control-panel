/**
 * Sentry Webhook Handler for Activity Feed
 * 
 * Receives webhooks from Sentry and creates activity events
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { activityService } from "@/lib/activity/activity-service";
import { normalizeSentryIssue } from "@/lib/activity/event-normalizers";
import { SentryIssuePayload } from "@/lib/activity/types";
import { storeWebhookEvent } from "@/lib/webhooks/webhook-service";
import { webhookLimiter } from "@/lib/rate-limiter";
import { RateLimitError } from "@/lib/api-errors";

const SENTRY_WEBHOOK_SECRET = process.env.SENTRY_WEBHOOK_SECRET;

function verifySentrySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
  try {
    await webhookLimiter.checkLimit(request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: error.retryAfter },
        { status: 429, headers: { "Retry-After": String(error.retryAfter || 60) } }
      );
    }
    throw error;
  }

  try {
    const body = await request.text();
    let payload: SentryIssuePayload;

    if (SENTRY_WEBHOOK_SECRET) {
      // Verify the webhook signature
      const signature = request.headers.get("sentry-hook-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      if (!verifySentrySignature(body, signature, SENTRY_WEBHOOK_SECRET)) {
        console.error("Sentry webhook verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    payload = JSON.parse(body);

    // Check if this is an issue event
    const resource = request.headers.get("sentry-hook-resource");
    if (resource !== "issue") {
      return NextResponse.json({ received: true, processed: false, reason: "Not an issue event" });
    }

    // Normalize and create activity event
    const activityEvent = normalizeSentryIssue(payload);
    await activityService.create(activityEvent);

    await storeWebhookEvent({
      source: "sentry",
      eventType: payload.action,
      title: `Sentry: ${payload.action}`,
      description: payload.data?.issue?.title || "Sentry issue event",
      severity: payload.action === "created" ? "warning" : "info",
      metadata: { issueId: payload.data?.issue?.id },
      timestamp: new Date(),
    });

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error("Sentry webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

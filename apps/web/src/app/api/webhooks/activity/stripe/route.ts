/**
 * Stripe Webhook Handler for Activity Feed
 * 
 * Receives webhooks from Stripe and creates activity events
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { activityService } from "@/lib/activity/activity-service";
import { normalizeStripePayment } from "@/lib/activity/event-normalizers";
import { StripePaymentPayload } from "@/lib/activity/types";
import { storeWebhookEvent } from "@/lib/webhooks/webhook-service";
import { webhookLimiter } from "@/lib/rate-limiter";
import { RateLimitError } from "@/lib/api-errors";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Event types we care about for activity feed
const TRACKED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount?: number;
      currency?: string;
      customer?: string;
      status?: string;
      metadata?: Record<string, string>;
    };
  };
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): { valid: boolean; timestamp?: number } {
  // Parse the signature header
  const elements = signature.split(",");
  const signatureMap: Record<string, string> = {};
  
  for (const element of elements) {
    const [key, value] = element.split("=");
    signatureMap[key] = value;
  }
  
  const timestamp = parseInt(signatureMap["t"], 10);
  const v1Signature = signatureMap["v1"];
  
  if (!timestamp || !v1Signature) {
    return { valid: false };
  }
  
  // Check timestamp tolerance (5 minutes)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false };
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  
  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    );
    return { valid, timestamp };
  } catch {
    return { valid: false };
  }
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
    let event: StripeEvent;

    if (STRIPE_WEBHOOK_SECRET) {
      // Verify the webhook signature
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      const { valid } = verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
      if (!valid) {
        console.error("Stripe webhook verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    event = JSON.parse(body) as StripeEvent;

    // Check if this is an event type we track
    if (!TRACKED_EVENTS.includes(event.type)) {
      return NextResponse.json({ received: true, processed: false, reason: "Event type not tracked" });
    }

    // Convert to our payload format
    const payload: StripePaymentPayload = {
      type: event.type as StripePaymentPayload["type"],
      data: {
        object: event.data.object,
      },
    };

    // Normalize and create activity event
    const activityEvent = normalizeStripePayment(payload);
    await activityService.create(activityEvent);

    await storeWebhookEvent({
      source: "stripe",
      eventType: event.type,
      title: `Stripe: ${event.type}`,
      description: `Payment event: ${event.type}`,
      severity: event.type.includes("failed") ? "warning" : "info",
      metadata: { eventId: event.id, amount: event.data.object.amount },
      timestamp: new Date(),
    });

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

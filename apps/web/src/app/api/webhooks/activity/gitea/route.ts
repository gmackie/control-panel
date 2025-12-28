/**
 * Gitea Webhook Handler for Activity Feed
 * 
 * Receives webhooks from Gitea and creates activity events
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { activityService } from "@/lib/activity/activity-service";
import { 
  normalizeGiteaPush, 
  normalizeGiteaPullRequest, 
  normalizeGiteaWorkflow 
} from "@/lib/activity/event-normalizers";
import { 
  GiteaPushPayload, 
  GiteaPullRequestPayload, 
  GiteaWorkflowPayload 
} from "@/lib/activity/types";

const GITEA_WEBHOOK_SECRET = process.env.GITEA_WEBHOOK_SECRET;

function verifyGiteaSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    if (GITEA_WEBHOOK_SECRET) {
      // Verify the webhook signature
      const signature = request.headers.get("x-gitea-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      if (!verifyGiteaSignature(body, signature, GITEA_WEBHOOK_SECRET)) {
        console.error("Gitea webhook verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const eventType = request.headers.get("x-gitea-event");
    const payload = JSON.parse(body);

    let activityEvents;

    switch (eventType) {
      case "push":
        activityEvents = normalizeGiteaPush(payload as GiteaPushPayload);
        break;

      case "pull_request":
        activityEvents = [normalizeGiteaPullRequest(payload as GiteaPullRequestPayload)];
        break;

      case "workflow_run":
        activityEvents = [normalizeGiteaWorkflow(payload as GiteaWorkflowPayload)];
        break;

      default:
        // Log but don't fail for unknown event types
        console.log("Unhandled Gitea event type:", eventType);
        return NextResponse.json({ 
          received: true, 
          processed: false, 
          reason: `Event type '${eventType}' not tracked` 
        });
    }

    // Create activity events
    if (activityEvents.length === 1) {
      await activityService.create(activityEvents[0]);
    } else {
      await activityService.createMany(activityEvents);
    }

    return NextResponse.json({ 
      received: true, 
      processed: true, 
      eventsCreated: activityEvents.length 
    });
  } catch (error) {
    console.error("Gitea webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
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
import { verifyGiteaWebhook } from "@/lib/webhooks/signature-verification";
import { webhookLimiter } from "@/lib/rate-limiter";
import { RateLimitError } from "@/lib/api-errors";

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
    const giteaSecret = process.env.GITEA_WEBHOOK_SECRET;

    if (giteaSecret) {
      const signature = request.headers.get("x-gitea-signature");
      const verification = verifyGiteaWebhook(body, signature, giteaSecret);
      if (!verification.valid) {
        console.error("Gitea webhook verification failed:", verification.error);
        return NextResponse.json({ error: verification.error }, { status: 401 });
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

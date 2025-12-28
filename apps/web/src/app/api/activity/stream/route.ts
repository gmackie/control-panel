/**
 * Activity Stream API (Server-Sent Events)
 * 
 * GET /api/activity/stream - Subscribe to real-time activity events
 * 
 * Clients connect via EventSource and receive events as they happen.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { activityService } from "@/lib/activity/activity-service";
import { ActivityEvent } from "@/lib/activity/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get optional filters from query params
  const { searchParams } = new URL(request.url);
  const sourcesFilter = searchParams.get("sources")?.split(",").filter(Boolean);
  const categoriesFilter = searchParams.get("categories")?.split(",").filter(Boolean);
  const severitiesFilter = searchParams.get("severities")?.split(",").filter(Boolean);
  const appIdsFilter = searchParams.get("appIds")?.split(",").filter(Boolean);

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Subscribe to activity events
      const unsubscribe = activityService.subscribe((event: ActivityEvent) => {
        // Apply filters if specified
        if (sourcesFilter && sourcesFilter.length > 0 && !sourcesFilter.includes(event.source)) {
          return;
        }
        if (categoriesFilter && categoriesFilter.length > 0 && !categoriesFilter.includes(event.category)) {
          return;
        }
        if (severitiesFilter && severitiesFilter.length > 0 && !severitiesFilter.includes(event.severity)) {
          return;
        }
        if (appIdsFilter && appIdsFilter.length > 0 && event.appId && !appIdsFilter.includes(event.appId)) {
          return;
        }

        try {
          const message = `data: ${JSON.stringify({ type: "event", event })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream might be closed
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          // Stream might be closed
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeatInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

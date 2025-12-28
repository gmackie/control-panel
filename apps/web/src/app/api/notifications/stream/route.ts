/**
 * Notification Stream API
 * 
 * GET - Server-Sent Events stream for real-time notifications
 */

import { NextRequest } from "next/server";
import { notificationService } from "@/lib/notifications/notification-service";
import { Notification } from "@/lib/notifications/types";

/**
 * GET /api/notifications/stream
 * 
 * Server-Sent Events stream for real-time notifications
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Get userId from query params for filtering
  const userId = request.nextUrl.searchParams.get("userId") || undefined;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Subscribe to notification updates
      const unsubscribe = notificationService.subscribe((notification: Notification) => {
        // Filter by userId if specified
        if (userId && notification.userId && notification.userId !== userId) {
          return;
        }

        try {
          const data = JSON.stringify({
            type: "notification",
            notification,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error("Error sending notification to stream:", error);
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          // Connection might be closed
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Handle client disconnect
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
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

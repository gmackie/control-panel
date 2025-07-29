import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real-time metrics stream using Server-Sent Events
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`)
      );
      
      // Set up interval to send metrics every 5 seconds
      const interval = setInterval(async () => {
        try {
          // Fetch real-time metrics
          const metrics = await getRealtimeMetrics();
          
          // Send metrics as SSE
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "metrics", data: metrics, timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch (error) {
          console.error("Error fetching metrics:", error);
        }
      }, 5000);
      
      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
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

async function getRealtimeMetrics() {
  // In production, this would fetch from actual services
  // For now, generate realistic changing data
  
  const baseMetrics = {
    activeUsers: 245 + Math.floor(Math.random() * 20),
    requestsPerSecond: 150 + Math.floor(Math.random() * 50),
    avgResponseTime: 45 + Math.floor(Math.random() * 20),
    errorRate: Number((0.1 + Math.random() * 0.5).toFixed(2)),
    cpuUsage: 30 + Math.floor(Math.random() * 40),
    memoryUsage: 45 + Math.floor(Math.random() * 30),
    activeConnections: 1200 + Math.floor(Math.random() * 200),
    throughput: {
      in: (2.5 + Math.random() * 1.5).toFixed(2),
      out: (3.2 + Math.random() * 2).toFixed(2),
    },
  };
  
  return baseMetrics;
}
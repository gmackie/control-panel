/**
 * GET /api/cluster/health/issues/stream
 *
 * Server-Sent Events endpoint that streams real-time cluster health events
 * from the ClusterHealthWatcher singleton.
 *
 * Events:
 *   snapshot          - Full cluster health snapshot (every poll)
 *   podIssue          - New pod issue detected
 *   nodeIssue         - New node issue detected
 *   podIssueResolved  - Previously tracked pod issue resolved
 *   nodeIssueResolved - Previously tracked node issue resolved
 *   keepalive         - Heartbeat every 30s to keep connection alive
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/check-auth";
import { getClusterHealthWatcher } from "@/lib/monitoring/cluster-health-watcher";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const watcher = getClusterHealthWatcher();

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // ---- Event listeners ----

    const onSnapshot = (snapshot: unknown) => sendEvent("snapshot", snapshot);
    const onPodIssue = (issue: unknown) => sendEvent("podIssue", issue);
    const onNodeIssue = (issue: unknown) => sendEvent("nodeIssue", issue);
    const onPodIssueResolved = (issue: unknown) => sendEvent("podIssueResolved", issue);
    const onNodeIssueResolved = (issue: unknown) => sendEvent("nodeIssueResolved", issue);

    watcher.on("snapshot", onSnapshot);
    watcher.on("podIssue", onPodIssue);
    watcher.on("nodeIssue", onNodeIssue);
    watcher.on("podIssueResolved", onPodIssueResolved);
    watcher.on("nodeIssueResolved", onNodeIssueResolved);

    // ---- Keep-alive ----

    const keepAlive = setInterval(async () => {
      try {
        await writer.write(encoder.encode("event: keepalive\ndata: {}\n\n"));
      } catch {
        cleanup();
      }
    }, 30_000);

    // ---- Cleanup (shared by abort + write failure) ----

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      watcher.off("snapshot", onSnapshot);
      watcher.off("podIssue", onPodIssue);
      watcher.off("nodeIssue", onNodeIssue);
      watcher.off("podIssueResolved", onPodIssueResolved);
      watcher.off("nodeIssueResolved", onNodeIssueResolved);
      clearInterval(keepAlive);
      writer.close().catch(() => {});
    };

    const sendEvent = async (event: string, data: unknown) => {
      try {
        await writer.write(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      } catch {
        cleanup();
      }
    };

    request.signal.addEventListener("abort", cleanup);

    // Send the latest snapshot immediately so the client has initial state
    const latest = watcher.getLatestSnapshot();
    if (latest) {
      await sendEvent("snapshot", latest);
    }

    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create health issues stream";
    console.error("[cluster/health/issues/stream] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

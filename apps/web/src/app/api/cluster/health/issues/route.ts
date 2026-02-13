/**
 * GET /api/cluster/health/issues
 *
 * Returns the current cluster health state: whether the watcher is running,
 * a summary snapshot, and all active pod/node issues.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/check-auth";
import { getClusterHealthWatcher } from "@/lib/monitoring/cluster-health-watcher";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const watcher = getClusterHealthWatcher();
  const issues = watcher.getActiveIssues();
  const snapshot = watcher.getLatestSnapshot();

  return NextResponse.json({
    running: watcher.isRunning(),
    timestamp: snapshot?.timestamp ?? null,
    summary: snapshot
      ? {
          nodes: { total: snapshot.nodes.total, ready: snapshot.nodes.ready },
          pods: { total: snapshot.pods.total, running: snapshot.pods.running },
        }
      : null,
    issues: {
      nodes: issues.nodes,
      pods: issues.pods,
      total: issues.nodes.length + issues.pods.length,
    },
  });
}

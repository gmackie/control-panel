/**
 * Restart Deployment API
 *
 * POST /api/secrets/restart
 *
 * Triggers a rolling restart on the app's K8s deployment
 * so new secrets take effect.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMultiClusterManager } from "@/lib/cluster/multi-cluster-manager";
import type { ClusterId } from "@/types/k8s";
import { getDb } from "@repo/db";
import { applications, eq } from "@repo/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, clusterId = "production" } = body as {
      applicationId: string;
      clusterId?: ClusterId;
    };

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const namespace = app.k8sNamespace || app.slug || "default";
    const deploymentName = app.k8sDeploymentName || app.slug;

    if (!deploymentName) {
      return NextResponse.json({ error: "No K8s deployment name configured for this app" }, { status: 400 });
    }

    const manager = getMultiClusterManager();
    await manager.restartDeployment(clusterId, namespace, deploymentName);

    return NextResponse.json({
      status: "restarted",
      cluster: clusterId,
      namespace,
      deployment: deploymentName,
    });
  } catch (err) {
    console.error("[secrets/restart] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restart failed" },
      { status: 500 }
    );
  }
}

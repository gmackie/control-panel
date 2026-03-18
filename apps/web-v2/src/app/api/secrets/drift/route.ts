/**
 * Drift Detection API
 *
 * POST /api/secrets/drift
 *
 * Compares DB secret values against K8s secret values.
 * Marks secrets as "drift" if they diverge.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMultiClusterManager } from "@/lib/cluster/multi-cluster-manager";
import type { ClusterId } from "@/types/k8s";
import { getDb } from "@repo/db";
import { appSecrets, applications, eq, and } from "@repo/db";
import { decryptSecret } from "@repo/api/src/lib/crypto";
import { createHash } from "crypto";

function hashValue(val: string): string {
  return createHash("sha256").update(val).digest("hex").slice(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId } = body as { applicationId: string };

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

    const k8sNamespace = app.k8sNamespace || app.slug || "default";
    const k8sSecretName = `${app.slug}-secrets`;

    // Get all secrets for this app
    const secrets = await db
      .select()
      .from(appSecrets)
      .where(eq(appSecrets.applicationId, applicationId));

    if (secrets.length === 0) {
      return NextResponse.json({ checked: 0, drifted: 0, missing: 0 });
    }

    const manager = getMultiClusterManager();

    // Determine which clusters to check
    const k8sTargets = new Set<ClusterId>();
    for (const secret of secrets) {
      const targets = JSON.parse(secret.syncTargets) as string[];
      for (const t of targets) {
        if (t.startsWith("k8s:")) k8sTargets.add(t.replace("k8s:", "") as ClusterId);
      }
    }
    if (k8sTargets.size === 0) k8sTargets.add("production");

    let drifted = 0;
    let missing = 0;
    let checked = 0;

    for (const clusterId of k8sTargets) {
      // Read the K8s secret
      const k8sSecret = await manager.readSecret(clusterId, k8sNamespace, k8sSecretName);

      for (const secret of secrets) {
        checked++;

        // Decrypt DB value
        let dbValue: string;
        try {
          dbValue = decryptSecret(secret.encryptedValue, secret.iv);
        } catch {
          continue; // Skip corrupted secrets
        }

        const dbHash = hashValue(dbValue);

        if (!k8sSecret) {
          // K8s secret doesn't exist at all
          if (secret.lastSyncStatus !== "pending") {
            missing++;
            await db
              .update(appSecrets)
              .set({ lastSyncStatus: "drift", lastSyncError: "K8s secret not found" })
              .where(eq(appSecrets.id, secret.id));
          }
          continue;
        }

        const k8sValue = k8sSecret.data[secret.key];
        if (k8sValue === undefined) {
          // Key missing from K8s secret
          if (secret.lastSyncStatus === "synced") {
            missing++;
            await db
              .update(appSecrets)
              .set({ lastSyncStatus: "drift", lastSyncError: "Key missing from K8s secret" })
              .where(eq(appSecrets.id, secret.id));
          }
          continue;
        }

        const k8sHash = hashValue(k8sValue);
        if (dbHash !== k8sHash) {
          drifted++;
          await db
            .update(appSecrets)
            .set({ lastSyncStatus: "drift", lastSyncError: "Value differs from K8s" })
            .where(eq(appSecrets.id, secret.id));
        } else if (secret.lastSyncStatus === "drift") {
          // Was drifted but now matches — resolve
          await db
            .update(appSecrets)
            .set({ lastSyncStatus: "synced", lastSyncError: null, lastSyncedAt: new Date() })
            .where(eq(appSecrets.id, secret.id));
        }
      }
    }

    return NextResponse.json({ checked, drifted, missing });
  } catch (err) {
    console.error("[secrets/drift] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Drift check failed" },
      { status: 500 }
    );
  }
}

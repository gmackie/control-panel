/**
 * Secret Sync API
 *
 * POST /api/secrets/sync
 *
 * Syncs secrets from the DB to K8s clusters (and Vercel in the future).
 * Called by the frontend after saving a secret.
 *
 * Flow:
 *   1. Read secrets from DB for the app
 *   2. Decrypt each secret
 *   3. Write to K8s secret in the target cluster/namespace
 *   4. Update sync status in DB
 */

import { NextRequest, NextResponse } from "next/server";
import { getMultiClusterManager } from "@/lib/cluster/multi-cluster-manager";
import { syncToVercel } from "@/lib/vercel/sync";
import type { ClusterId } from "@/types/k8s";

import { getDb } from "@repo/db";
import { appSecrets, applications, orgIntegrations, eq, and } from "@repo/db";
import { decryptSecret } from "@repo/api/src/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, secretIds, targets } = body as {
      applicationId: string;
      secretIds?: string[]; // If provided, sync only these. Otherwise sync all.
      targets?: string[]; // If provided, sync to these targets only.
    };

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    // Get the app to find K8s namespace and secret name
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

    // Get secrets to sync
    const conditions = [eq(appSecrets.applicationId, applicationId)];
    const secrets = await db
      .select()
      .from(appSecrets)
      .where(and(...conditions));

    if (secrets.length === 0) {
      return NextResponse.json({ synced: 0, message: "No secrets to sync" });
    }

    // Filter to requested secret IDs if provided
    const toSync = secretIds
      ? secrets.filter((s) => secretIds.includes(s.id))
      : secrets;

    // Decrypt all secrets
    const decrypted: Record<string, string> = {};
    const decryptErrors: string[] = [];

    for (const secret of toSync) {
      try {
        decrypted[secret.key] = decryptSecret(secret.encryptedValue, secret.iv);
      } catch {
        decryptErrors.push(secret.key);
      }
    }

    // Determine K8s targets from secrets' syncTargets
    const k8sTargets = new Set<ClusterId>();
    for (const secret of toSync) {
      const syncTargetList = JSON.parse(secret.syncTargets) as string[];
      for (const target of syncTargetList) {
        if (target.startsWith("k8s:")) {
          k8sTargets.add(target.replace("k8s:", "") as ClusterId);
        }
      }
    }

    // If no explicit targets on secrets, default to production
    if (k8sTargets.size === 0) {
      k8sTargets.add("production");
    }

    // Override with explicit targets parameter
    if (targets) {
      k8sTargets.clear();
      for (const t of targets) {
        if (t.startsWith("k8s:")) {
          k8sTargets.add(t.replace("k8s:", "") as ClusterId);
        }
      }
    }

    // Sync to each K8s cluster
    const manager = getMultiClusterManager();
    const results: { target: string; status: string; error?: string }[] = [];

    for (const clusterId of k8sTargets) {
      try {
        const result = await manager.writeSecret(
          clusterId,
          k8sNamespace,
          k8sSecretName,
          decrypted
        );
        results.push({
          target: `k8s:${clusterId}`,
          status: "synced",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({
          target: `k8s:${clusterId}`,
          status: "failed",
          error: message,
        });
      }
    }

    // Sync to Vercel targets
    const vercelTargets = new Set<string>();
    for (const secret of toSync) {
      const syncTargetList = JSON.parse(secret.syncTargets) as string[];
      for (const target of syncTargetList) {
        if (target.startsWith("vercel:")) {
          vercelTargets.add(target.replace("vercel:", ""));
        }
      }
    }

    if (vercelTargets.size > 0) {
      // Get Vercel credentials from orgIntegrations
      try {
        const [vercelIntegration] = await db
          .select()
          .from(orgIntegrations)
          .where(eq(orgIntegrations.provider, "vercel"))
          .limit(1);

        if (vercelIntegration?.credentials) {
          const creds = JSON.parse(vercelIntegration.credentials) as { token?: string; teamId?: string };
          // Get Vercel project ID from app's integrations (appIntegrations)
          // For now use app slug as project name — Vercel projects can be looked up by name
          const vercelToken = creds.token ?? process.env.VERCEL_TOKEN;

          if (vercelToken) {
            for (const vercelTarget of vercelTargets) {
              try {
                const vercelResult = await syncToVercel(
                  vercelToken,
                  app.slug!,
                  decrypted,
                  vercelTarget as "production" | "preview" | "development",
                  creds.teamId ?? process.env.VERCEL_TEAM_ID
                );
                results.push({
                  target: `vercel:${vercelTarget}`,
                  status: vercelResult.failed > 0 ? "failed" : "synced",
                  error: vercelResult.errors.length > 0 ? vercelResult.errors.join("; ") : undefined,
                });
              } catch (err) {
                results.push({
                  target: `vercel:${vercelTarget}`,
                  status: "failed",
                  error: err instanceof Error ? err.message : "Vercel sync failed",
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[secrets/sync] Vercel sync skipped:", err);
      }
    }

    // Update sync status in DB for each secret
    const allSynced = results.every((r) => r.status === "synced");
    const syncStatus = allSynced ? "synced" : "failed";
    const syncError = results.find((r) => r.error)?.error ?? null;

    for (const secret of toSync) {
      if (decryptErrors.includes(secret.key)) continue;
      await db
        .update(appSecrets)
        .set({
          lastSyncStatus: syncStatus,
          lastSyncedAt: new Date(),
          lastSyncError: syncError,
        })
        .where(eq(appSecrets.id, secret.id));
    }

    // Mark decrypt errors
    for (const key of decryptErrors) {
      const secret = toSync.find((s) => s.key === key);
      if (secret) {
        await db
          .update(appSecrets)
          .set({
            lastSyncStatus: "failed",
            lastSyncError: "Decryption failed — re-enter the value",
          })
          .where(eq(appSecrets.id, secret.id));
      }
    }

    return NextResponse.json({
      synced: results.filter((r) => r.status === "synced").length,
      failed: results.filter((r) => r.status === "failed").length,
      decryptErrors: decryptErrors.length,
      results,
      secretName: k8sSecretName,
      namespace: k8sNamespace,
    });
  } catch (err) {
    console.error("[secrets/sync] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

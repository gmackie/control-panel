/**
 * Environment Promotion API
 *
 * POST /api/secrets/promote
 *
 * Promotes secrets from one environment to another (e.g., staging → production).
 * Returns a diff for approval before applying.
 *
 * Modes:
 *   - preview: Returns diff without applying
 *   - apply: Copies secrets and syncs
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@repo/db";
import { appSecrets, eq, and } from "@repo/db";
import { encryptSecret, decryptSecret } from "@repo/api/src/lib/crypto";

interface PromotionDiff {
  key: string;
  action: "add" | "update" | "unchanged";
  sourceValue?: string; // masked
  targetValue?: string; // masked
}

function mask(val: string): string {
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "****" + val.slice(-4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      applicationId,
      sourceEnvironment = "staging",
      targetEnvironment = "production",
      mode = "preview",
    } = body as {
      applicationId: string;
      sourceEnvironment: string;
      targetEnvironment: string;
      mode: "preview" | "apply";
    };

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    // Get source secrets
    const sourceSecrets = await db
      .select()
      .from(appSecrets)
      .where(and(
        eq(appSecrets.applicationId, applicationId),
        eq(appSecrets.environment, sourceEnvironment),
      ));

    // Get target secrets
    const targetSecrets = await db
      .select()
      .from(appSecrets)
      .where(and(
        eq(appSecrets.applicationId, applicationId),
        eq(appSecrets.environment, targetEnvironment),
      ));

    const targetByKey = new Map(targetSecrets.map((s) => [s.key, s]));

    // Build diff
    const diff: PromotionDiff[] = [];

    for (const source of sourceSecrets) {
      let sourceDecrypted: string;
      try {
        sourceDecrypted = decryptSecret(source.encryptedValue, source.iv);
      } catch {
        continue;
      }

      const target = targetByKey.get(source.key);

      if (!target) {
        diff.push({
          key: source.key,
          action: "add",
          sourceValue: mask(sourceDecrypted),
        });
      } else {
        let targetDecrypted: string;
        try {
          targetDecrypted = decryptSecret(target.encryptedValue, target.iv);
        } catch {
          diff.push({
            key: source.key,
            action: "update",
            sourceValue: mask(sourceDecrypted),
            targetValue: "[decryption failed]",
          });
          continue;
        }

        if (sourceDecrypted === targetDecrypted) {
          diff.push({
            key: source.key,
            action: "unchanged",
            sourceValue: mask(sourceDecrypted),
            targetValue: mask(targetDecrypted),
          });
        } else {
          diff.push({
            key: source.key,
            action: "update",
            sourceValue: mask(sourceDecrypted),
            targetValue: mask(targetDecrypted),
          });
        }
      }
    }

    if (mode === "preview") {
      return NextResponse.json({
        mode: "preview",
        sourceEnvironment,
        targetEnvironment,
        total: diff.length,
        adds: diff.filter((d) => d.action === "add").length,
        updates: diff.filter((d) => d.action === "update").length,
        unchanged: diff.filter((d) => d.action === "unchanged").length,
        diff,
      });
    }

    // Apply — copy source secrets to target
    let applied = 0;
    for (const source of sourceSecrets) {
      const diffEntry = diff.find((d) => d.key === source.key);
      if (!diffEntry || diffEntry.action === "unchanged") continue;

      let sourceDecrypted: string;
      try {
        sourceDecrypted = decryptSecret(source.encryptedValue, source.iv);
      } catch {
        continue;
      }

      // Re-encrypt for the target (fresh IV)
      const { encryptedValue, iv } = encryptSecret(sourceDecrypted);

      const existing = targetByKey.get(source.key);

      if (existing) {
        await db
          .update(appSecrets)
          .set({
            encryptedValue,
            iv,
            category: source.category,
            provider: source.provider,
            sensitive: source.sensitive,
            syncTargets: source.syncTargets.replace(sourceEnvironment, targetEnvironment),
            lastSyncStatus: "pending",
            lastSyncError: null,
            updatedAt: new Date(),
          })
          .where(eq(appSecrets.id, existing.id));
      } else {
        await db
          .insert(appSecrets)
          .values({
            applicationId,
            key: source.key,
            encryptedValue,
            iv,
            environment: targetEnvironment,
            category: source.category,
            provider: source.provider,
            sensitive: source.sensitive,
            syncTargets: source.syncTargets.replace(sourceEnvironment, targetEnvironment),
            lastSyncStatus: "pending",
          });
      }
      applied++;
    }

    return NextResponse.json({
      mode: "apply",
      sourceEnvironment,
      targetEnvironment,
      applied,
      total: diff.length,
    });
  } catch (err) {
    console.error("[secrets/promote] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Promotion failed" },
      { status: 500 }
    );
  }
}

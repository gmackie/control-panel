/**
 * Seed Default Cluster Health Notification Rules
 *
 * Idempotent: checks for existing rules by name before creating.
 * Called once during server startup via instrumentation.ts.
 */

import { getDbAsync } from "@/lib/db";
import { notificationRules } from "@repo/db";
import { rulesEngine } from "@/lib/notifications/rules-engine";
import type { ChannelConfig, DedupeSettings, RuleConditions } from "@/lib/notifications/types";

interface SeedRule {
  name: string;
  description: string;
  priority: number;
  conditions: RuleConditions;
  channels: ChannelConfig[];
  dedupe: DedupeSettings;
}

const SEED_RULES: SeedRule[] = [
  {
    name: "Cluster Health - Critical",
    description:
      "Route critical cluster health alerts to all channels (in-app, slack, push, email). Dedupe window 15 minutes, grouped by source + title.",
    priority: 10,
    conditions: {
      sources: ["cluster-health-watcher"],
      severities: ["critical"],
    },
    channels: [
      { type: "in-app", enabled: true, config: {} },
      { type: "slack", enabled: true, config: {} },
      { type: "push", enabled: true, config: {} },
      { type: "email", enabled: true, config: {} },
    ],
    dedupe: {
      enabled: true,
      windowMinutes: 15,
      groupBy: ["source", "title"],
    },
  },
  {
    name: "Cluster Health - Warning",
    description:
      "Route warning-level cluster health alerts to in-app and slack. Dedupe window 30 minutes.",
    priority: 20,
    conditions: {
      sources: ["cluster-health-watcher"],
      severities: ["warning"],
    },
    channels: [
      { type: "in-app", enabled: true, config: {} },
      { type: "slack", enabled: true, config: {} },
    ],
    dedupe: {
      enabled: true,
      windowMinutes: 30,
      groupBy: ["source", "title"],
    },
  },
  {
    name: "Cluster Health - Resolved",
    description:
      "Route resolved (info) cluster health notifications to in-app and slack. Dedupe window 5 minutes.",
    priority: 30,
    conditions: {
      sources: ["cluster-health-watcher"],
      severities: ["info"],
    },
    channels: [
      { type: "in-app", enabled: true, config: {} },
      { type: "slack", enabled: true, config: {} },
    ],
    dedupe: {
      enabled: true,
      windowMinutes: 5,
      groupBy: ["source", "title"],
    },
  },
];

/**
 * Seed cluster health notification rules into the database.
 * Idempotent - skips rules that already exist (matched by name).
 */
export async function seedClusterHealthRules(): Promise<void> {
  const db = await getDbAsync();
  if (!db) {
    console.warn("[seed-health-rules] Database not available, skipping seed");
    return;
  }

  try {
    // Fetch all existing rules once
    const existingRules = await db.select().from(notificationRules);
    const existingNames = new Set(existingRules.map((r) => r.name));

    let created = 0;

    for (const seed of SEED_RULES) {
      if (existingNames.has(seed.name)) {
        console.log(`[seed-health-rules] Rule "${seed.name}" already exists, skipping`);
        continue;
      }

      const now = new Date();
      await db.insert(notificationRules).values({
        name: seed.name,
        description: seed.description,
        enabled: true,
        priority: seed.priority,
        conditions: JSON.stringify(seed.conditions),
        channels: JSON.stringify(seed.channels),
        dedupe: JSON.stringify(seed.dedupe),
        schedule: null,
        createdAt: now,
        updatedAt: now,
        createdBy: "system",
      });

      console.log(`[seed-health-rules] Created rule "${seed.name}"`);
      created++;
    }

    if (created > 0) {
      // Reload rules in the engine so new rules take effect immediately
      await rulesEngine.loadRules();
      console.log(`[seed-health-rules] Seeded ${created} rule(s) and reloaded rules engine`);
    } else {
      console.log("[seed-health-rules] All rules already exist, nothing to seed");
    }
  } catch (error) {
    console.error("[seed-health-rules] Failed to seed rules:", error);
  }
}

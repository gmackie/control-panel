import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  activityEvents,
  alerts,
  notifications,
  deploymentHistory,
} from "@repo/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WebhookSource =
  | "argocd"
  | "harbor"
  | "prometheus"
  | "gitea"
  | "clerk"
  | "stripe"
  | "sentry";

export type Severity = "info" | "warning" | "critical";

export interface WebhookEventData {
  source: WebhookSource;
  eventType: string;
  appName?: string;
  appId?: string;
  environment?: string;
  title: string;
  description?: string;
  severity: Severity;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface AlertData {
  fingerprint?: string;
  name: string;
  severity: Severity;
  status: "firing" | "resolved";
  startsAt: Date;
  endsAt?: Date | null;
  summary: string;
  description?: string;
  labels?: Record<string, string>;
}

export interface DeploymentData {
  applicationId: string;
  applicationName: string;
  environment: string;
  action: "deploy" | "rollback" | "scale" | "sync" | "build";
  version?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  image?: string;
  replicas?: number;
  status:
    | "pending"
    | "queued"
    | "running"
    | "in_progress"
    | "building"
    | "testing"
    | "deploying"
    | "verifying"
    | "succeeded"
    | "success"
    | "failed"
    | "error"
    | "cancelled"
    | "canceled"
    | "rolled_back"
    | "healthy"
    | "unhealthy"
    | "superseded"
    | "pending_approval";
  triggeredBy: string;
  details?: string;
  metadata?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  deploymentHistoryId?: string;
}

export interface NotificationData {
  source: WebhookSource;
  category: string;
  severity: Severity;
  title: string;
  message: string;
  appName?: string;
  appId?: string;
  environment?: string;
  links?: Array<{ url: string; label: string }>;
  actions?: Array<{ label: string; action: string }>;
  groupKey?: string;
}

// ---------------------------------------------------------------------------
// Database type — accepts any Drizzle-compatible db instance
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = { insert: (...args: any[]) => any; update: (...args: any[]) => any; select: (...args: any[]) => any };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const activeDeploymentStatuses = [
  "pending",
  "queued",
  "running",
  "in_progress",
  "building",
  "testing",
  "deploying",
  "verifying",
] as const;

const deploymentStatusAliases: Record<string, string> = {
  pending: "pending",
  queued: "queued",
  running: "running",
  in_progress: "in_progress",
  building: "building",
  testing: "testing",
  deploying: "deploying",
  verifying: "verifying",
  succeeded: "succeeded",
  success: "succeeded",
  healthy: "succeeded",
  failed: "failed",
  error: "failed",
  unhealthy: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  rolled_back: "rolled_back",
  superseded: "superseded",
  pending_approval: "pending_approval",
};

export function normalizeMetadata(
  raw?: Record<string, unknown> | null,
): string | null {
  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }
  return JSON.stringify(raw);
}

export function mergeMetadata(
  existingRaw: string | null,
  incoming?: Record<string, unknown>,
): string | null {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existingRaw || null;
  }

  let existing: Record<string, unknown> = {};
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  return JSON.stringify({ ...existing, ...incoming });
}

export function toNormalizedStatus(status: string): string {
  return deploymentStatusAliases[status] ?? status;
}

export function buildDeploymentPayload(data: DeploymentData) {
  const normalizedStatus = toNormalizedStatus(data.status);

  return {
    deploymentId: crypto.randomUUID(),
    applicationId: data.applicationId,
    applicationName: data.applicationName,
    environment: data.environment,
    action: data.action,
    version: data.version || null,
    commitSha: data.commitSha || null,
    commitMessage: data.commitMessage || null,
    branch: data.branch || null,
    image: data.image || null,
    replicas: data.replicas || null,
    status: normalizedStatus,
    triggeredBy: data.triggeredBy,
    details: data.details || null,
    metadata: normalizeMetadata(data.metadata),
    startedAt: data.startedAt ?? new Date(),
    completedAt: data.completedAt || null,
  };
}

// ---------------------------------------------------------------------------
// Public API — every function takes `db: Database | null` as first param
// ---------------------------------------------------------------------------

export async function storeWebhookEvent(
  db: Database | null,
  data: WebhookEventData,
): Promise<string | null> {
  try {
    if (!db) {
      console.log("[Webhook] DB unavailable, skipping event store");
      return null;
    }

    const result = await db
      .insert(activityEvents)
      .values({
        source: data.source,
        category: "webhook",
        eventType: data.eventType,
        severity: data.severity,
        appId: data.appId,
        appName: data.appName,
        environment: data.environment,
        title: data.title,
        description: data.description,
        actorType: "system",
        actorId: data.source,
        actorName: `${data.source} webhook`,
        metadata: normalizeMetadata(data.metadata),
        timestamp: data.timestamp || new Date(),
      })
      .returning({ id: activityEvents.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to store webhook event:", error);
    return null;
  }
}

export async function storeAlert(
  db: Database | null,
  data: AlertData,
): Promise<string | null> {
  try {
    if (!db) {
      console.log("[Webhook] DB unavailable, skipping alert store");
      return null;
    }

    const result = await db
      .insert(alerts)
      .values({
        name: data.name,
        severity: data.severity,
        status: data.status,
        startsAt: data.startsAt,
        endsAt: data.endsAt ?? null,
        summary: data.summary,
        description: data.description,
        labels: data.labels ? JSON.stringify(data.labels) : null,
      })
      .returning({ id: alerts.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to store alert:", error);
    return null;
  }
}

export async function updateAlertStatus(
  db: Database | null,
  name: string,
  fingerprint: string,
  status: "firing" | "resolved",
  endsAt?: Date,
): Promise<boolean> {
  try {
    if (!db) {
      console.log("[Webhook] DB unavailable, skipping alert status update");
      return false;
    }

    if (!fingerprint) {
      await db
        .update(alerts)
        .set({
          status,
          endsAt: endsAt || new Date(),
        })
        .where(and(eq(alerts.name, name), eq(alerts.status, "firing")));
      return true;
    }

    await db
      .update(alerts)
      .set({
        status,
        endsAt: endsAt || new Date(),
      })
      .where(
        and(
          eq(alerts.name, name),
          eq(alerts.status, "firing"),
          sql`${alerts.labels} LIKE ${`%"fingerprint":"${fingerprint}"%`}`,
        ),
      );

    return true;
  } catch (error) {
    console.error("Failed to update alert status:", error);
    return false;
  }
}

export async function storeDeploymentEvent(
  db: Database | null,
  data: DeploymentData,
): Promise<string | null> {
  try {
    if (!db) {
      console.log("[Webhook] DB unavailable, skipping deployment store");
      return null;
    }

    const payload = buildDeploymentPayload(data);
    const normalizedStatus = payload.status;

    // 1. If caller provides an explicit deployment history ID, update that row
    if (data.deploymentHistoryId) {
      const [existingById] = await db
        .select({
          id: deploymentHistory.id,
          metadata: deploymentHistory.metadata,
        })
        .from(deploymentHistory)
        .where(eq(deploymentHistory.id, data.deploymentHistoryId))
        .limit(1);

      if (existingById) {
        await db
          .update(deploymentHistory)
          .set({
            status: normalizedStatus,
            action: data.action,
            version: payload.version,
            commitSha: payload.commitSha,
            commitMessage: payload.commitMessage,
            branch: payload.branch,
            image: payload.image,
            replicas: payload.replicas,
            details: payload.details,
            metadata: mergeMetadata(existingById.metadata, data.metadata),
            ...(data.startedAt ? { startedAt: data.startedAt } : {}),
            ...(data.completedAt ? { completedAt: data.completedAt } : {}),
          })
          .where(eq(deploymentHistory.id, data.deploymentHistoryId));

        return existingById.id;
      }
    }

    // 2. Find an active deployment for the same app/env/action and update it
    const [activeDeployment] = await db
      .select({
        id: deploymentHistory.id,
        metadata: deploymentHistory.metadata,
      })
      .from(deploymentHistory)
      .where(
        and(
          eq(deploymentHistory.applicationId, data.applicationId),
          eq(deploymentHistory.environment, data.environment),
          eq(deploymentHistory.action, data.action),
          inArray(deploymentHistory.status, activeDeploymentStatuses),
        ),
      )
      .orderBy(desc(deploymentHistory.startedAt))
      .limit(1);

    if (activeDeployment) {
      await db
        .update(deploymentHistory)
        .set({
          status: normalizedStatus,
          action: data.action,
          version: payload.version,
          commitSha: payload.commitSha,
          commitMessage: payload.commitMessage,
          branch: payload.branch,
          image: payload.image,
          replicas: payload.replicas,
          details: payload.details,
          metadata: mergeMetadata(activeDeployment.metadata, data.metadata),
          ...(data.startedAt ? { startedAt: data.startedAt } : {}),
          ...(data.completedAt ? { completedAt: data.completedAt } : {}),
        })
        .where(eq(deploymentHistory.id, activeDeployment.id));

      return activeDeployment.id;
    }

    // 3. Insert new row
    const result = await db
      .insert(deploymentHistory)
      .values(payload)
      .returning({ id: deploymentHistory.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to store deployment event:", error);
    return null;
  }
}

export async function createNotification(
  db: Database | null,
  data: NotificationData,
): Promise<string | null> {
  try {
    if (!db) {
      console.log("[Webhook] DB unavailable, skipping notification");
      return null;
    }

    const result = await db
      .insert(notifications)
      .values({
        source: data.source,
        category: data.category,
        severity: data.severity,
        title: data.title,
        message: data.message,
        appId: data.appId,
        appName: data.appName,
        environment: data.environment,
        links: data.links ? JSON.stringify(data.links) : null,
        actions: data.actions ? JSON.stringify(data.actions) : null,
        groupKey: data.groupKey,
        status: "new",
      })
      .returning({ id: notifications.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

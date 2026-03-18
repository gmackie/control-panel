import { getDb, activityEvents, notifications, alerts, deploymentHistory, eq, and, desc, inArray } from "@repo/db";

type WebhookSource = "argocd" | "harbor" | "prometheus" | "gitea" | "clerk" | "stripe" | "sentry";
type Severity = "info" | "warning" | "critical";

interface WebhookEventData {
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

interface AlertData {
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

interface DeploymentData {
  applicationId: string;
  applicationName: string;
  environment: string;
  action: "deploy" | "rollback" | "scale" | "sync";
  version?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  image?: string;
  replicas?: number;
  status: "pending" | "queued" | "running" | "in_progress" | "building" | "testing" | "deploying" | "verifying" | "succeeded" | "success" | "failed" | "error" | "cancelled" | "canceled";
  triggeredBy: string;
  details?: string;
  metadata?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  deploymentHistoryId?: string;
}

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

const deploymentStatusAliases = {
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
  failed: "failed",
  error: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
} as const;

type DeploymentStatusAlias = keyof typeof deploymentStatusAliases;

function normalizeMetadata(raw?: Record<string, unknown> | null): string | null {
  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }

  return JSON.stringify(raw);
}

function mergeMetadata(existingRaw: string | null, incoming?: Record<string, unknown>): string | null {
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

  return JSON.stringify({
    ...existing,
    ...incoming,
  });
}

function toNormalizedStatus(status: string): string {
  if (status in deploymentStatusAliases) {
    return deploymentStatusAliases[status as DeploymentStatusAlias];
  }

  return status;
}

function buildDeploymentPayload(data: DeploymentData) {
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

interface NotificationData {
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

export async function storeWebhookEvent(data: WebhookEventData): Promise<string | null> {
  try {
    const db = getDb();

    const result = await db.insert(activityEvents).values({
      source: data.source,
      category: "webhook",
      eventType: data.eventType,
      severity: data.severity,
      appName: data.appName,
      environment: data.environment,
      title: data.title,
      description: data.description,
      actorType: "system",
      actorId: data.source,
      actorName: `${data.source} webhook`,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      timestamp: data.timestamp || new Date(),
    }).returning({ id: activityEvents.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to store webhook event:", error);
    return null;
  }
}

export async function storeAlert(data: AlertData): Promise<string | null> {
  try {
    const db = getDb();

    const result = await db.insert(alerts).values({
      name: data.name,
      severity: data.severity,
      status: data.status,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      summary: data.summary,
      description: data.description,
      labels: data.labels ? JSON.stringify(data.labels) : null,
    }).returning({ id: alerts.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to store alert:", error);
    return null;
  }
}

export async function updateAlertStatus(
  fingerprint: string,
  status: "firing" | "resolved",
  endsAt?: Date
): Promise<boolean> {
  try {
    const db = getDb();

    await db.update(alerts)
      .set({
        status,
        endsAt: endsAt || new Date(),
      })
      .where(eq(alerts.name, fingerprint));

    return true;
  } catch (error) {
    console.error("Failed to update alert status:", error);
    return false;
  }
}

export async function storeDeploymentEvent(data: DeploymentData): Promise<string | null> {
  try {
    const db = getDb();
    const payload = buildDeploymentPayload(data);

    const metadata = payload.metadata;
    const normalizedStatus = payload.status;

    if (data.deploymentHistoryId) {
      const [existingById] = await db
        .select({ id: deploymentHistory.id, metadata: deploymentHistory.metadata })
        .from(deploymentHistory)
        .where(eq(deploymentHistory.id, data.deploymentHistoryId))
        .limit(1);

      if (existingById) {
        await db.update(deploymentHistory)
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
          inArray(deploymentHistory.status, activeDeploymentStatuses)
        )
      )
      .orderBy(desc(deploymentHistory.startedAt))
      .limit(1);

    if (activeDeployment) {
      await db.update(deploymentHistory)
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

    const result = await db.insert(deploymentHistory).values(payload).returning({ id: deploymentHistory.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to store deployment event:", error);
    return null;
  }
}

export async function createNotification(data: NotificationData): Promise<string | null> {
  try {
    const db = getDb();

    const result = await db.insert(notifications).values({
      source: data.source,
      category: data.category,
      severity: data.severity,
      title: data.title,
      message: data.message,
      appName: data.appName,
      environment: data.environment,
      links: data.links ? JSON.stringify(data.links) : null,
      actions: data.actions ? JSON.stringify(data.actions) : null,
      groupKey: data.groupKey,
      status: "new",
    }).returning({ id: notifications.id });

    return result[0]?.id || null;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

export async function sendSlackNotification(payload: {
  title: string;
  message: string;
  severity: Severity;
  url?: string;
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("Slack webhook URL not configured, skipping notification");
    return false;
  }

  const colorMap: Record<Severity, string> = {
    info: "#36a64f",
    warning: "#ff9800",
    critical: "#f44336",
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          color: colorMap[payload.severity],
          title: payload.title,
          text: payload.message,
          footer: "GMAC Control Panel",
          ts: Math.floor(Date.now() / 1000),
          ...(payload.url && { title_link: payload.url }),
        }],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

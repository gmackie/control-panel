import crypto from "node:crypto";
import {
  type ForgeGraphRollbackPayload,
  type ParsedRollbackPolicy,
  type RollbackDecision,
  type RollbackSeverity,
  type RollbackPolicyEnvironment,
} from "./types";
import {
  getControlPlaneClientConfig,
  sendControlPlaneRollback,
} from "./control-plane";

// ---------------------------------------------------------------------------
// Env parsing helpers
// ---------------------------------------------------------------------------

export function readBooleanEnv(
  input: string | undefined,
  defaultValue: boolean,
): boolean {
  if (input == null || input.trim().length === 0) {
    return defaultValue;
  }

  const normalized = input.trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

export function readCommaList(
  input: string | undefined,
  fallback: string[],
): string[] {
  if (!input) {
    return fallback;
  }

  const values = input
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
}

export function readIntEnv(
  input: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(input ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Label normalization
// ---------------------------------------------------------------------------

export function normalizeEnvironmentLabel(
  value: string | undefined,
): string {
  if (!value) return "";

  const normalized = value.toLowerCase();
  if (normalized.includes("prod")) return "production";
  if (normalized.includes("stag")) return "staging";
  if (normalized.includes("dev")) return "development";
  if (normalized.includes("preview")) return "preview";
  return normalized;
}

export function normalizeSeverityForPolicy(
  value: string | undefined,
): RollbackSeverity {
  const normalized = (value || "").toLowerCase();

  if (
    normalized === "critical" ||
    normalized === "fatal" ||
    normalized === "emergency"
  ) {
    return "critical";
  }

  if (
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "high" ||
    normalized === "medium"
  ) {
    return "warning";
  }

  return "info";
}

export function firstNonEmpty(
  input: Record<string, string | undefined>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const candidate = input[key];
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function mapPrometheusSeverity(
  value?: string,
): "info" | "warning" | "critical" {
  switch ((value || "").toLowerCase()) {
    case "critical":
    case "fatal":
    case "emergency":
      return "critical";
    case "warning":
    case "warn":
    case "high":
    case "medium":
      return "warning";
    default:
      return "info";
  }
}

// ---------------------------------------------------------------------------
// Rollback policy config
// ---------------------------------------------------------------------------

export function getRollbackPolicyConfig(): ParsedRollbackPolicy {
  const enabled = readBooleanEnv(
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED ??
      process.env.PROMETHEUS_AUTO_ROLLBACK_ENABLED,
    false,
  );

  const token = (
    process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.FORGEGRAPH_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_BEARER_TOKEN ||
    ""
  ).trim();

  // Safety: if enabled but no token configured, force-disable
  if (enabled && !token) {
    return {
      enabled: false,
      severities: ["critical"],
      environments: ["production"] as RollbackPolicyEnvironment[],
      dedupeWindowMs: 5 * 60 * 1000,
      dryRun: false,
    };
  }

  return {
    enabled,
    severities: readCommaList(
      process.env.FORGEGRAPH_AUTO_ROLLBACK_SEVERITIES ??
        process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES,
      ["critical"],
    ) as RollbackSeverity[],
    environments: readCommaList(
      process.env.FORGEGRAPH_AUTO_ROLLBACK_ENVIRONMENTS ??
        process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS,
      ["production"],
    ) as RollbackPolicyEnvironment[],
    dedupeWindowMs: readIntEnv(
      process.env.FORGEGRAPH_ROLLBACK_DEDUPE_WINDOW_MS ??
        process.env.PROMETHEUS_ROLLBACK_DEDUPE_WINDOW_MS,
      5 * 60 * 1000,
    ),
    dryRun: readBooleanEnv(
      process.env.FORGEGRAPH_ROLLBACK_DRY_RUN,
      false,
    ),
  };
}

// ---------------------------------------------------------------------------
// Dedupe tracking (LRU-capped at 1000 entries)
// ---------------------------------------------------------------------------

const DEDUPE_LRU_CAP = 1000;
const controlPlaneRollbackDedupe = new Map<string, number>();

export function cleanupDedupes(): void {
  const now = Date.now();
  for (const [key, expiresAt] of controlPlaneRollbackDedupe.entries()) {
    if (expiresAt <= now) {
      controlPlaneRollbackDedupe.delete(key);
    }
  }

  // LRU cap: if still over limit, evict oldest entries
  if (controlPlaneRollbackDedupe.size > DEDUPE_LRU_CAP) {
    const entries = [...controlPlaneRollbackDedupe.entries()].sort(
      (a, b) => a[1] - b[1],
    );
    const toRemove = entries.length - DEDUPE_LRU_CAP;
    for (let i = 0; i < toRemove; i++) {
      controlPlaneRollbackDedupe.delete(entries[i]![0]);
    }
  }
}

export function hasRecentRollbackDecision(dedupeKey: string): boolean {
  cleanupDedupes();
  const now = Date.now();
  const existing = controlPlaneRollbackDedupe.get(dedupeKey);
  if (existing && existing > now) {
    return true;
  }
  const dedupeWindowMs = getRollbackPolicyConfig().dedupeWindowMs;
  controlPlaneRollbackDedupe.set(dedupeKey, now + dedupeWindowMs);
  return false;
}

/** Reset dedupe map — for testing only */
export function _resetDedupeMap(): void {
  controlPlaneRollbackDedupe.clear();
}

// ---------------------------------------------------------------------------
// Prometheus alert types (shared with route handlers)
// ---------------------------------------------------------------------------

export interface PrometheusAlert {
  status?: "firing" | "resolved";
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL?: string;
  fingerprint: string;
}

export interface AlertmanagerWebhookPayload {
  status?: "firing" | "resolved";
  receiver?: string;
  groupKey?: string;
  truncatedAlerts?: number;
  alerts: PrometheusAlert[];
  commonLabels?: Record<string, string>;
  commonAnnotations?: Record<string, string>;
  groupLabels?: Record<string, string>;
  version?: string;
  externalURL?: string;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function extractRepoName(
  labels: Record<string, string | undefined>,
  commonLabels?: Record<string, string | undefined>,
): string | undefined {
  return (
    firstNonEmpty(labels, [
      "repository",
      "repo",
      "project",
      "repository_name",
      "service",
      "app",
    ]) ||
    firstNonEmpty(commonLabels ?? {}, [
      "repository",
      "repo",
      "project",
      "service",
    ])
  );
}

export function createControlPlanePayload(
  alert: PrometheusAlert,
  commonMetadata: {
    namespace?: string;
    environment?: string;
    commonLabels?: Record<string, string>;
  },
): ForgeGraphRollbackPayload | null {
  const repoName = extractRepoName(alert.labels, {
    repository: commonMetadata.commonLabels?.repository,
    repo: commonMetadata.commonLabels?.repo,
    project: commonMetadata.commonLabels?.project,
    service: commonMetadata.commonLabels?.service,
    app: commonMetadata.commonLabels?.app,
  });
  if (!repoName) {
    return null;
  }

  const sourceDeploymentId = firstNonEmpty(alert.labels, [
    "source_deployment_id",
    "sourceDeploymentId",
  ]);
  const sourceRevision = firstNonEmpty(alert.labels, [
    "source_revision",
    "sourceRevision",
    "revision",
    "sha",
    "commit",
  ]);
  const rollbackImageTag =
    firstNonEmpty(alert.annotations, [
      "rollback_image_tag",
      "rollback_image",
      "image_tag",
    ]) ||
    firstNonEmpty(alert.labels, [
      "rollback_image_tag",
      "rollback_image",
      "image_tag",
    ]);
  const reason =
    firstNonEmpty(alert.labels, ["reason", "rollback_reason"]) ||
    firstNonEmpty(alert.annotations, ["reason", "rollback_reason"]) ||
    `${alert.labels.alertname} ${alert.labels.namespace || "default namespace"}`;

  const environment =
    normalizeEnvironmentLabel(
      firstNonEmpty(alert.labels, ["environment", "env"]) ||
        commonMetadata.environment ||
        commonMetadata.namespace,
    ) ||
    normalizeEnvironmentLabel(commonMetadata.commonLabels?.environment) ||
    "production";

  return {
    source: "alertmanager",
    repoName,
    environment: environment as ForgeGraphRollbackPayload["environment"],
    sourceDeploymentId,
    sourceRevision,
    rollbackImageTag,
    reason,
    metadata: {
      source: "alertmanager",
      alertname: alert.labels.alertname,
      fingerprint: alert.fingerprint,
      severity: alert.labels.severity,
      namespace: alert.labels.namespace,
      pod: alert.labels.pod,
      service: alert.labels.service,
      reasonSource: "prometheus-webhook",
    },
  };
}

export function mapPayloadContext(
  alert: PrometheusAlert,
  payload: AlertmanagerWebhookPayload,
): {
  namespace?: string;
  environment?: string;
  commonLabels: Record<string, string>;
} {
  return {
    namespace:
      firstNonEmpty(alert.labels, ["namespace"]) ||
      firstNonEmpty(payload.commonLabels ?? {}, ["namespace"]) ||
      "unknown",
    environment:
      normalizeEnvironmentLabel(
        firstNonEmpty(alert.labels, ["environment", "env"]) ||
          firstNonEmpty(payload.commonLabels ?? {}, [
            "environment",
            "env",
          ]) ||
          firstNonEmpty(alert.labels, ["namespace"]),
      ) || "production",
    commonLabels: payload.commonLabels ?? {},
  };
}

// ---------------------------------------------------------------------------
// Single-alert evaluation
// ---------------------------------------------------------------------------

export async function evaluateAlertRollback(
  alert: PrometheusAlert,
  payload: AlertmanagerWebhookPayload,
): Promise<RollbackDecision> {
  const policy = getRollbackPolicyConfig();
  const alertName = alert.labels.alertname || "unknown";

  if (!policy.enabled) {
    return {
      alertName,
      action: "disabled",
      reason: "Rollback policy disabled in environment",
    };
  }

  const commonMetadata = mapPayloadContext(alert, payload);
  const resolvedSeverity = normalizeSeverityForPolicy(
    alert.labels.severity,
  );
  const resolvedEnvironment =
    normalizeEnvironmentLabel(
      firstNonEmpty(alert.labels, ["environment", "env"]) ||
        commonMetadata.environment ||
        commonMetadata.namespace ||
        firstNonEmpty(commonMetadata.commonLabels, [
          "environment",
          "env",
        ]),
    ) || "production";
  const allowedEnvironments = new Set(
    policy.environments.map((entry) => entry.toLowerCase()),
  );

  if (!policy.severities.includes(resolvedSeverity)) {
    return {
      alertName,
      action: "skipped",
      reason: `Severity "${resolvedSeverity}" not in policy allowlist`,
    };
  }

  if (!allowedEnvironments.has(resolvedEnvironment)) {
    return {
      alertName,
      action: "skipped",
      reason: `Environment "${resolvedEnvironment}" not in rollback policy environments`,
    };
  }

  const controlPlanePayload = createControlPlanePayload(
    alert,
    commonMetadata,
  );
  if (!controlPlanePayload) {
    return {
      alertName,
      action: "no-target",
      reason: "Missing repo context for control-plane rollback",
    };
  }

  if (
    !controlPlanePayload.sourceDeploymentId &&
    !controlPlanePayload.sourceRevision &&
    !controlPlanePayload.rollbackImageTag
  ) {
    return {
      alertName,
      action: "no-target",
      reason:
        "Missing sourceRevision or rollbackImageTag in alert payload",
    };
  }

  const dedupeSeed = [
    controlPlanePayload.repoName,
    controlPlanePayload.environment,
    controlPlanePayload.sourceDeploymentId,
    controlPlanePayload.sourceRevision,
    controlPlanePayload.rollbackImageTag,
    alert.fingerprint,
  ]
    .filter(Boolean)
    .join("|");

  if (hasRecentRollbackDecision(dedupeSeed)) {
    return {
      alertName,
      action: "deduped",
      reason:
        "Rollback event deduplicated within configured window",
    };
  }

  // Dry-run mode: log but don't send
  if (policy.dryRun) {
    return {
      alertName,
      action: "dry-run",
      reason: "Dry-run mode enabled — rollback would have been triggered",
      response: {
        payload: controlPlanePayload,
      },
    };
  }

  const clientConfig = getControlPlaneClientConfig();
  if (!clientConfig) {
    return {
      alertName,
      action: "disabled",
      reason:
        "ForgeGraph control-plane callback not configured in this environment",
    };
  }

  const requestId = crypto.randomUUID();
  const response = await sendControlPlaneRollback(
    {
      ...controlPlanePayload,
      metadata: {
        ...controlPlanePayload.metadata,
        controlPlaneRequestAt: new Date().toISOString(),
        controlPlaneRequestId: requestId,
        sourceAlertStatus: alert.status || payload.status || "firing",
      },
    },
    requestId,
    clientConfig,
  );

  return {
    alertName,
    action: "triggered",
    reason: "Rollback request submitted to ForgeGraph",
    response: {
      requestId,
      statusCode: response.statusCode,
      body: response.body,
      repoName: controlPlanePayload.repoName,
      environment: controlPlanePayload.environment,
    },
  };
}

// ---------------------------------------------------------------------------
// Batch evaluation — trigger at most ONE rollback per batch
// ---------------------------------------------------------------------------

export async function evaluateBatchRollback(
  alerts: PrometheusAlert[],
  payload: AlertmanagerWebhookPayload,
): Promise<RollbackDecision[]> {
  const decisions: RollbackDecision[] = [];
  let rollbackTriggered = false;

  for (const alert of alerts) {
    const batchAlertName = alert.labels.alertname || "unknown";
    if (rollbackTriggered) {
      decisions.push({
        alertName: batchAlertName,
        action: "deduped",
        reason: "Only one rollback per batch — already triggered",
      });
      continue;
    }

    try {
      const decision = await evaluateAlertRollback(alert, payload);
      decisions.push(decision);
      if (
        decision.action === "triggered" ||
        decision.action === "dry-run"
      ) {
        rollbackTriggered = true;
      }
    } catch (error) {
      decisions.push({
        alertName: batchAlertName,
        action: "failed",
        reason:
          error instanceof Error
            ? error.message
            : "Failed to trigger control-plane rollback",
      });
    }
  }

  return decisions;
}

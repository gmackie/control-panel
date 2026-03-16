import { NextRequest, NextResponse } from "next/server";
import {
  verifyBearerToken,
  RateLimitError,
  storeWebhookEvent,
  storeAlert,
  updateAlertStatus,
  createNotification,
  webhookLimiter,
} from "@repo/webhooks";
import {
  evaluateBatchRollback,
  getRollbackPolicyConfig,
  normalizeEnvironmentLabel,
  firstNonEmpty,
  mapPrometheusSeverity,
  type AlertmanagerWebhookPayload,
} from "@repo/forgegraph";
import { getDb } from "@/lib/db";

function nowIso8601(): string {
  return new Date().toISOString();
}

async function handleFiringAlert(alert: AlertmanagerWebhookPayload["alerts"][number]): Promise<void> {
  const db = getDb();
  const summary = alert.annotations.summary || alert.labels.alertname || "Unknown";
  const description = alert.annotations.description || "";

  await createNotification(db, {
    source: "prometheus",
    category: "alert",
    severity: mapPrometheusSeverity(alert.labels.severity),
    title: `🚨 Alert: ${summary}`,
    message: description,
    appName: alert.labels.service || alert.labels.job || alert.labels.namespace,
    environment: normalizeEnvironmentLabel(
      alert.labels.environment || alert.labels.env || alert.labels.namespace,
    ),
    links: alert.generatorURL
      ? [{ url: alert.generatorURL, label: "View in Prometheus" }]
      : undefined,
    groupKey: alert.fingerprint,
  });
}

async function handleResolvedAlert(alert: AlertmanagerWebhookPayload["alerts"][number]): Promise<void> {
  const db = getDb();
  const summary = alert.annotations.summary || alert.labels.alertname || "Unknown";

  await createNotification(db, {
    source: "prometheus",
    category: "alert",
    severity: "info",
    title: `✅ Resolved: ${summary}`,
    message: "Alert has been resolved",
    appName: alert.labels.service || alert.labels.job || alert.labels.namespace,
    environment: normalizeEnvironmentLabel(
      alert.labels.environment || alert.labels.env || alert.labels.namespace,
    ),
    groupKey: alert.fingerprint,
  });
}

export async function POST(request: NextRequest) {
  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    await webhookLimiter.checkLimit(request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: error.retryAfter },
        { status: 429, headers: { "Retry-After": String(error.retryAfter || 60) } },
      );
    }
    throw error;
  }

  const prometheusToken = process.env.PROMETHEUS_BEARER_TOKEN;
  const token = request.headers.get("Authorization");
  const webhookToken = request.headers.get("x-webhook-token");
  const verification = verifyBearerToken(token, webhookToken, prometheusToken ?? "");

  if (!verification.valid) {
    return NextResponse.json(
      { error: "Unauthorized", reason: verification.error },
      { status: 401 },
    );
  }

  let payload: AlertmanagerWebhookPayload;
  try {
    payload = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    throw err;
  }

  if (!payload || !Array.isArray(payload.alerts)) {
    return NextResponse.json({ error: "Invalid payload: alerts array is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const rollbackPolicy = getRollbackPolicyConfig();

    // Process each alert: persist + notifications
    for (const alert of payload.alerts) {
      const alertStatus = alert.status || payload.status || "firing";
      const severity = mapPrometheusSeverity(alert.labels.severity);
      const alertName = alert.labels.alertname || "unknown";
      const startsAt = new Date(alert.startsAt || nowIso8601());
      const endsAt = alert.endsAt ? new Date(alert.endsAt) : null;

      await storeAlert(db, {
        fingerprint: alert.fingerprint,
        name: alertName,
        severity,
        status: alertStatus as "firing" | "resolved",
        startsAt,
        endsAt,
        summary: alert.annotations.summary || alertName,
        description: alert.annotations.description,
        labels: {
          ...alert.labels,
          fingerprint: alert.fingerprint,
          alertStatus,
          sourcePayloadStatus: payload.status || "firing",
        },
      });

      if (alertStatus === "firing") {
        await handleFiringAlert(alert);
      } else {
        await updateAlertStatus(db, alertName, alert.fingerprint, "resolved", endsAt || new Date());
        await handleResolvedAlert(alert);
      }
    }

    // Evaluate rollback policy for firing alerts
    const firingAlerts = payload.alerts.filter(
      (a) => (a.status || payload.status || "firing") === "firing",
    );
    const decisions = firingAlerts.length > 0
      ? await evaluateBatchRollback(firingAlerts, payload)
      : [];

    await storeWebhookEvent(db, {
      source: "prometheus",
      eventType: "alert",
      title: `Prometheus: ${payload.alerts.length} alerts`,
      description: `Receiver: ${payload.receiver || "unknown"}`,
      severity: mapPrometheusSeverity(payload.alerts[0]?.labels.severity),
      metadata: {
        status: payload.status || "firing",
        policyEnabled: rollbackPolicy.enabled,
        rollbackDecisions: decisions,
        alertCount: payload.alerts.length,
        groupKey: payload.groupKey,
        commonLabels: payload.commonLabels,
      },
      appName: payload.alerts[0]?.labels.app || payload.alerts[0]?.labels.service,
      environment:
        normalizeEnvironmentLabel(
          firstNonEmpty(payload.alerts[0]?.labels || {}, ["environment", "env", "namespace"]),
        ) || "production",
    });

    const failedRollbacks = decisions.filter((d) => d.action === "failed").length;
    const processingTimeMs = Date.now() - startMs;

    return NextResponse.json(
      {
        success: true,
        processed: payload.alerts.length,
        status: payload.status || "firing",
        controlPlaneRollbacks: decisions,
      },
      {
        status: failedRollbacks > 0 ? 502 : 200,
        headers: {
          "X-Processing-Time-Ms": String(processingTimeMs),
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    console.error("Error processing Prometheus webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "Prometheus Alert Webhook Handler",
    status: "active",
    features: [
      "Alert persistence",
      "Activity event tracking",
      "Environment/Severity gated rollback forwarding",
      "Control-plane integration with rollback dedupe",
    ],
  });
}

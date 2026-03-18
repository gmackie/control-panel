"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import type { HealthMetric } from "@/components/monitoring/health-overview-strip";
import type { AlertEvent } from "@/components/monitoring/alert-timeline";
import type { AppHealthItem } from "@/components/monitoring/app-health-grid";

const POLL_INTERVAL = 30_000;

/** System-wide health metrics for the overview strip */
export function useHealthMetrics() {
  const { data: summary } = trpc.monitoring.healthSummary.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL,
  });

  const metrics = useMemo<HealthMetric[]>(() => {
    if (!summary) return [];
    return [
      {
        label: "Active Alerts",
        value: summary.alerts.total > 0 ? `${summary.alerts.total} firing` : "None",
      },
      {
        label: "Error Rate",
        value: `${summary.metrics.errorRate ?? 0}%`,
      },
      {
        label: "Avg CPU",
        value: `${summary.metrics.avgCpu ?? 0}%`,
      },
      {
        label: "Avg Memory",
        value: `${summary.metrics.avgMemory ?? 0}%`,
      },
    ].filter((m) => m.value !== "0%" && m.value !== "None" || true);
  }, [summary]);

  return { data: metrics };
}

/** Alert timeline from monitoring.alerts */
export function useAlertTimeline(options?: { appId?: string; limit?: number }) {
  const { data: alerts, ...rest } = trpc.monitoring.alerts.useQuery(
    { appId: options?.appId, limit: options?.limit ?? 50 },
    { refetchInterval: POLL_INTERVAL }
  );

  const alertEvents = useMemo<AlertEvent[]>(() => {
    if (!alerts) return [];
    return alerts.map((a) => ({
      id: a.id,
      timestamp: a.startsAt,
      severity: a.severity as "critical" | "warning" | "info",
      status: a.status as "firing" | "resolved" | "acknowledged",
      message: a.message,
      source: a.source,
      app: a.labels?.app ?? a.labels?.appId ?? undefined,
      environment: a.labels?.environment ?? a.labels?.namespace ?? undefined,
    }));
  }, [alerts]);

  return { data: alertEvents, ...rest };
}

/** Per-app health for the grid, from appOverview.list */
export function useAppHealthGrid() {
  const { data: apps, ...rest } = trpc.appOverview.list.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL,
  });

  const healthItems = useMemo<AppHealthItem[]>(() => {
    if (!apps) return [];
    return apps.map((app) => ({
      id: app.slug,
      name: app.name,
      slug: app.slug,
      status: app.health === "healthy"
        ? "healthy" as const
        : app.health === "warning"
          ? "degraded" as const
          : app.health === "critical"
            ? "unhealthy" as const
            : "unknown" as const,
      errorRate: app.metrics?.errorRate,
      latencyMs: app.metrics?.p95Latency,
      activeAlerts: app.alertCount ?? 0,
      lastDeploy: app.lastDeploy
        ? { version: app.lastDeploy.version ?? "—", time: app.lastDeploy.relativeTime ?? "—" }
        : undefined,
    }));
  }, [apps]);

  return { data: healthItems, ...rest };
}

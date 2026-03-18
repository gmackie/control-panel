"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import type { DeploymentJourney } from "@/types/pipeline";

/**
 * Fetches the latest deployment for correlation with metrics.
 * Returns the deployment journey and helper functions for
 * computing deploy markers and metric deltas.
 */
export function useDeployCorrelation(appId?: string) {
  const { data: journey } = trpc.pipelines.byApp.useQuery(
    { appId: appId!, limit: 1 },
    { enabled: !!appId, refetchInterval: 30_000 }
  );

  const latestDeploy = journey?.[0] ?? null;

  /**
   * Given a sparkline data array covering a time range,
   * compute which index corresponds to the deploy timestamp.
   * Returns an array of marker indices for SparklineCard.
   */
  const getDeployMarkers = useMemo(() => {
    return (dataLength: number, timeRangeMs: number): number[] => {
      if (!latestDeploy?.completedAt) return [];
      const deployAge = Date.now() - new Date(latestDeploy.completedAt).getTime();
      if (deployAge > timeRangeMs) return []; // Deploy is older than the chart range
      const position = Math.round(
        ((timeRangeMs - deployAge) / timeRangeMs) * (dataLength - 1)
      );
      return [Math.max(0, Math.min(position, dataLength - 1))];
    };
  }, [latestDeploy?.completedAt]);

  return {
    latestDeploy,
    deployVersion: latestDeploy?.commitSha?.slice(0, 7) ?? null,
    deployedAt: latestDeploy?.completedAt ?? null,
    getDeployMarkers,
  };
}

/**
 * Converts a ReleaseQueueItem or deployment row into a
 * DeploymentJourney suitable for the DeploymentDetailDrawer.
 */
export function toDrawerJourney(item: {
  id: string;
  appName: string;
  appSlug: string;
  version: string;
  environment: string;
  status: string;
  steps: DeploymentJourney["steps"];
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
}): DeploymentJourney {
  const currentStage =
    item.steps.find((s) => s.status === "running")?.stage ??
    item.steps.find((s) => s.status === "failed")?.stage ??
    [...item.steps].reverse().find((s) => s.status === "success")?.stage ??
    "commit";

  return {
    id: item.id,
    appId: item.appSlug,
    appName: item.appName,
    appSlug: item.appSlug,
    environment: item.environment,
    commitSha: item.version,
    commitMessage: "",
    branch: "main",
    triggeredBy: item.triggeredBy,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    status: item.status,
    currentStage,
    steps: item.steps,
  };
}

"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import type { ActiveRelease, ReleaseQueueItem } from "@/types/release";
import type { PipelineStep, PipelineStage } from "@/types/pipeline";

const POLL_INTERVAL = 15_000;

const activeStatuses = [
  "pending", "queued", "running", "in_progress",
  "building", "testing", "deploying", "verifying",
  "pending_approval",
];

function inferSteps(status: string): PipelineStep[] {
  const stages: PipelineStage[] = ["commit", "build", "test", "deploy", "verify"];
  const statusProgress: Record<string, number> = {
    pending: 0, queued: 0, pending_approval: 0,
    building: 1, testing: 2, deploying: 3, verifying: 4,
    running: 3, in_progress: 3,
    succeeded: 5, healthy: 5, deployed: 5,
    failed: -1, cancelled: -1, canceled: -1,
    rolled_back: -2, superseded: -3,
  };
  const progress = statusProgress[status] ?? 0;
  const isFailed = progress < 0;

  return stages.map((stage, i) => ({
    stage,
    status: isFailed
      ? (i === 0 ? "success" : i < Math.abs(progress) ? "success" : i === Math.abs(progress) ? "failed" : "skipped")
      : progress > i
        ? "success"
        : progress === i
          ? "running"
          : "pending",
  }));
}

function inferCurrentStage(status: string): PipelineStage {
  const map: Record<string, PipelineStage> = {
    building: "build", testing: "test", deploying: "deploy", verifying: "verify",
    running: "deploy", in_progress: "deploy",
    succeeded: "verify", healthy: "verify", deployed: "verify",
    failed: "deploy", pending: "commit", queued: "commit",
  };
  return map[status] ?? "deploy";
}

/** Active pipeline journeys (in-flight deployments) */
export function useActiveJourneys() {
  const { data: journeys, ...rest } = trpc.pipelines.journeys.useQuery(
    { limit: 10, activeOnly: true },
    { refetchInterval: POLL_INTERVAL }
  );

  const activeReleases = useMemo<ActiveRelease[]>(() => {
    if (!journeys) return [];
    return journeys.map((j) => ({
      id: j.id,
      type: "candidate" as const,
      appName: j.appName,
      appSlug: j.appSlug,
      version: j.commitSha?.slice(0, 7) || "unknown",
      environment: j.environment,
      status: j.currentStage,
      steps: j.steps,
      currentStage: j.currentStage,
      startedAt: j.startedAt,
      elapsedMs: Date.now() - new Date(j.startedAt).getTime(),
      triggeredBy: j.triggeredBy,
      requiresApproval: false, // TODO: check releasePolicies
      commitSha: j.commitSha,
    }));
  }, [journeys]);

  return { data: activeReleases, ...rest };
}

/** Recent deployments as release queue items */
export function useReleaseQueue(limit = 20) {
  const { data: deployments, ...rest } = trpc.deployments.list.useQuery(
    { limit },
    { refetchInterval: POLL_INTERVAL }
  );

  const queueItems = useMemo<ReleaseQueueItem[]>(() => {
    if (!deployments) return [];
    return deployments.map((d) => ({
      id: d.id,
      type: "deploy" as const,
      appName: d.appName ?? d.appId,
      appSlug: d.appId,
      version: d.version || d.imageTag || d.commitSha?.slice(0, 7) || "—",
      environment: d.environment,
      status: d.status,
      steps: inferSteps(d.status),
      triggeredBy: d.triggeredBy ?? "unknown",
      startedAt: d.startedAt ?? new Date().toISOString(),
      completedAt: d.completedAt ?? undefined,
      durationMs: d.startedAt && d.completedAt
        ? new Date(d.completedAt).getTime() - new Date(d.startedAt).getTime()
        : undefined,
    }));
  }, [deployments]);

  return { data: queueItems, ...rest };
}

/** Formal releases */
export function useReleases(limit = 20) {
  const { data: releases, ...rest } = trpc.releases.list.useQuery(
    { limit },
    { refetchInterval: 30_000 }
  );

  const releaseItems = useMemo<ReleaseQueueItem[]>(() => {
    const items = releases?.items ?? [];
    if (!items.length) return [];
    return items.map((r) => ({
      id: r.id,
      type: "release" as const,
      appName: r.applicationId, // TODO: join app name
      appSlug: r.applicationId,
      version: r.version,
      environment: "production",
      status: r.status,
      steps: inferSteps(r.status === "published" || r.status === "deployed" ? "succeeded" : r.status),
      triggeredBy: r.createdBy ?? "unknown",
      startedAt: new Date(r.createdAt).toISOString(),
      completedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : undefined,
      durationMs: r.createdAt && r.publishedAt
        ? new Date(r.publishedAt).getTime() - new Date(r.createdAt).getTime()
        : undefined,
    }));
  }, [releases]);

  return { data: releaseItems, ...rest };
}

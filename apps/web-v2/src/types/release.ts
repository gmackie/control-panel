import type { PipelineStep, PipelineStage } from "./pipeline";

export type ReleaseStatus = "draft" | "ready" | "published" | "deployed";
export type CandidateQueueState = "building" | "testing" | "awaiting_approval" | "approved" | "promoting" | "deployed" | "superseded" | "failed";
export type CandidateReadiness = "collecting" | "partial" | "complete" | "stale";

export interface Release {
  id: string;
  applicationId: string;
  appName: string;
  appSlug: string;
  version: string;
  name?: string;
  changelog?: string;
  status: ReleaseStatus;
  commitSha?: string;
  tagName?: string;
  isPrerelease: boolean;
  deployedEnvironments: string[];
  createdBy?: string;
  publishedBy?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface ReleaseCandidate {
  id: string;
  applicationId: string;
  appName: string;
  appSlug: string;
  gitSha?: string;
  branch?: string;
  imageTag?: string;
  queueState: CandidateQueueState;
  readinessStatus: CandidateReadiness;
  supersedeStatus: "current" | "superseded";
  knownGoodStatus: "unknown" | "known_good" | "known_bad";
  environment?: string;
  steps?: PipelineStep[];
  currentStage?: PipelineStage;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveRelease {
  /** Unified view for the release banner — could be a formal release or a candidate */
  id: string;
  type: "release" | "candidate";
  appName: string;
  appSlug: string;
  version: string;
  environment: string;
  status: string;
  steps: PipelineStep[];
  currentStage: PipelineStage;
  startedAt: string;
  elapsedMs: number;
  triggeredBy: string;
  requiresApproval: boolean;
  commitSha?: string;
}

export interface ReleaseQueueItem {
  id: string;
  type: "release" | "candidate" | "deploy";
  appName: string;
  appSlug: string;
  version: string;
  environment: string;
  status: string;
  steps: PipelineStep[];
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  /** MetricDelta-ready impact data */
  impact?: {
    errorRate?: { current: number; previous: number };
    latency?: { current: number; previous: number };
  };
}

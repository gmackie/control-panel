export type PipelineStage = "commit" | "build" | "test" | "deploy" | "verify";
export type PipelineStageStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface PipelineStep {
  stage: PipelineStage;
  status: PipelineStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  message?: string;
}

export interface DeploymentJourney {
  id: string;
  appId: string;
  appName: string;
  appSlug: string;
  environment: string;
  commitSha: string;
  commitMessage: string;
  branch: string;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  status?: string;
  currentStage: PipelineStage;
  steps: PipelineStep[];
  metadata?: Record<string, unknown>;
}

/** Labels for pipeline stages */
export const STAGE_LABELS: Record<PipelineStage, string> = {
  commit: "Commit",
  build: "Build",
  test: "Test",
  deploy: "Deploy",
  verify: "Verify",
};

/** Ordered pipeline stages */
export const PIPELINE_STAGES: PipelineStage[] = [
  "commit",
  "build",
  "test",
  "deploy",
  "verify",
];

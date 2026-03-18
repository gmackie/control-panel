import { z } from "zod";
import { protectedProcedure, router, publicProcedure } from "../trpc";
import { applications, deploymentHistory, desc, eq, sql, inArray } from "@repo/db";
import { TRPCError } from "@trpc/server";

export type PipelineStage = "commit" | "build" | "test" | "deploy" | "verify";
export type PipelineStageStatus = "pending" | "running" | "success" | "failed" | "skipped";

const pipelineStages: PipelineStage[] = ["commit", "build", "test", "deploy", "verify"];

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

const statusToStepState = {
  pending: "pending",
  queued: "pending",
  running: "running",
  in_progress: "running",
  building: "running",
  testing: "running",
  deploying: "running",
  verifying: "running",
  succeeded: "success",
  success: "success",
  failed: "failed",
  error: "failed",
  cancelled: "failed",
  canceled: "failed",
} as const;

type DeploymentStatusState = keyof typeof statusToStepState;

const deploymentProgressStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "in_progress",
  "building",
  "testing",
  "deploying",
  "verifying",
  "succeeded",
  "success",
  "failed",
  "error",
  "cancelled",
  "canceled",
]);

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
  currentStage: PipelineStage;
  steps: PipelineStep[];
}

type ParsedMetadata = Record<string, unknown>;
interface ParsedMetadataStep {
  stage: PipelineStage;
  status: PipelineStep["status"];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  message?: string;
}

function parseDeploymentMetadata(raw?: string | null): ParsedMetadata {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as ParsedMetadata;
  } catch {
    return {};
  }
}

function normalizeDeploymentStatus(status: string): string {
  return status.toLowerCase();
}

function parsePipelineStepStatus(value: unknown): PipelineStep["status"] | null {
  if (typeof value !== "string") return null;

  const normalized = value.toLowerCase();

  if (["success", "succeeded", "complete", "completed"].includes(normalized)) {
    return "success";
  }

  if (["failed", "failure", "error"].includes(normalized)) {
    return "failed";
  }

  if (["running", "in_progress", "building", "testing", "deploying", "verifying"].includes(normalized)) {
    return "running";
  }

  if (["pending", "queued", "waiting"].includes(normalized)) {
    return "pending";
  }

  if (["skipped", "cancelled", "canceled"].includes(normalized)) {
    return "skipped";
  }

  return null;
}

function parsePipelineStage(value: unknown): PipelineStage | null {
  if (typeof value !== "string") return null;

  switch (value.toLowerCase()) {
    case "commit":
    case "source":
      return "commit";
    case "build":
    case "building":
      return "build";
    case "test":
    case "testing":
      return "test";
    case "deploy":
    case "deploying":
    case "sync":
      return "deploy";
    case "verify":
    case "verifying":
      return "verify";
    default:
      return null;
  }
}

function parseMetadataSteps(metadata: ParsedMetadata): ParsedMetadataStep[] {
  const rawSteps = Array.isArray(metadata.steps)
    ? metadata.steps
    : Array.isArray((metadata.pipeline as { steps?: unknown[] } | undefined)?.steps)
      ? ((metadata.pipeline as { steps?: unknown[] }).steps ?? [])
      : [];

  const stepList: ParsedMetadataStep[] = [];

  for (const rawStep of rawSteps) {
    if (!rawStep || typeof rawStep !== "object") continue;

    const step = rawStep as Record<string, unknown>;
    const stage = parsePipelineStage(step.stage ?? step.name);
    if (!stage) continue;

    const status = parsePipelineStepStatus(step.status);
    if (!status) continue;

    stepList.push({
      stage,
      status,
      startedAt: typeof step.startedAt === "string" ? step.startedAt : undefined,
      completedAt: typeof step.completedAt === "string" ? step.completedAt : undefined,
      durationMs: typeof step.durationMs === "number" ? step.durationMs : undefined,
      message: typeof step.message === "string" ? step.message : undefined,
    });
  }

  return stepList;
}

function parseDeploymentStepFromMetadata(metadata: ParsedMetadata): PipelineStage | null {
  const candidates = [
    parsePipelineStage(metadata.deploymentStep),
    parsePipelineStage(metadata.currentStep),
    parsePipelineStage(metadata.current_step),
    parsePipelineStage(metadata.phase),
    parsePipelineStage(metadata.stage),
  ];

  return candidates.find((candidate): candidate is PipelineStage => candidate !== null) ?? null;
}

function inferDeploymentStepFromStatus(status: string): PipelineStage {
  const normalized = normalizeDeploymentStatus(status);

  if (normalized === "building") {
    return "build";
  }

  if (normalized === "testing") {
    return "test";
  }

  if (normalized === "deploying") {
    return "deploy";
  }

  if (normalized === "verifying") {
    return "verify";
  }

  return "deploy";
}

function buildFallbackPipelineSteps(
  status: string,
  action: string,
  startedAt: Date,
  completedAt: Date | null,
  metadataSteps: ParsedMetadataStep[],
  currentStepFromMetadata: PipelineStage | null
): PipelineStep[] {
  const normalizedStatus = normalizeDeploymentStatus(status);
  const currentStep = currentStepFromMetadata ?? (action === "deploy" ? "deploy" : "build");
  const currentStepIndex = pipelineStages.indexOf(currentStep);

  const stepMap = new Map<PipelineStage, ParsedMetadataStep>(
    metadataSteps.map((step) => [step.stage, step])
  );

  const aggregateStatus: PipelineStep["status"] =
    statusToStepState[normalizedStatus as DeploymentStatusState] || "pending";

  return pipelineStages.map((stage, index) => {
    const hasMetadata = stepMap.get(stage);

    const derivedStatus: PipelineStep["status"] = (() => {
      if (hasMetadata?.status) return hasMetadata.status;

      if (stage === "commit") {
        return aggregateStatus === "pending" ? "success" : "success";
      }

      if (aggregateStatus === "success") {
        return "success";
      }

      if (aggregateStatus === "running") {
        if (index < currentStepIndex) return "success";
        if (index === currentStepIndex) return "running";
        return "pending";
      }

      if (aggregateStatus === "failed") {
        if (index < currentStepIndex) return "success";
        if (index === currentStepIndex) return "failed";
        return "skipped";
      }

      return "pending";
    })();

    return {
      stage,
      status: derivedStatus,
      ...(hasMetadata?.startedAt ? { startedAt: hasMetadata.startedAt } : { startedAt: startedAt.toISOString() }),
      ...(hasMetadata?.completedAt
        ? { completedAt: hasMetadata.completedAt }
        : derivedStatus === "success" && completedAt
          ? { completedAt: completedAt.toISOString() }
          : {}),
      ...(hasMetadata?.durationMs ? { durationMs: hasMetadata.durationMs } : {}),
      ...(hasMetadata?.message ? { message: hasMetadata.message } : {}),
    };
  });
}

function mapDeploymentStatusToSteps(
  status: string,
  action: string,
  startedAt: Date,
  completedAt: Date | null,
  metadata: string | null
): PipelineStep[] {
  const normalizedMetadata = parseDeploymentMetadata(metadata);
  const parsedMetadataSteps = parseMetadataSteps(normalizedMetadata);
  const metadataStep = parseDeploymentStepFromMetadata(normalizedMetadata);
  const normalizedStatus = normalizeDeploymentStatus(status);

  if (parsedMetadataSteps.length > 0) {
    const currentStep = metadataStep ?? inferDeploymentStepFromStatus(normalizedStatus);
    return buildFallbackPipelineSteps(
      status,
      action,
      startedAt,
      completedAt,
      parsedMetadataSteps,
      currentStep
    );
  }

  if ([
    "pending",
    "queued",
    "running",
    "in_progress",
    "building",
    "testing",
    "deploying",
    "verifying",
  ].includes(normalizedStatus)) {
    const fallbackStage = metadataStep ?? inferDeploymentStepFromStatus(normalizedStatus);
    return buildFallbackPipelineSteps(
      status,
      action,
      startedAt,
      completedAt,
      [],
      fallbackStage
    );
  }

  if (["succeeded", "success"].includes(normalizedStatus)) {
    return buildFallbackPipelineSteps(
      "succeeded",
      action,
      startedAt,
      completedAt,
      [],
      metadataStep ?? "verify"
    );
  }

  if (["failed", "error", "cancelled", "canceled"].includes(normalizedStatus)) {
    return buildFallbackPipelineSteps(
      normalizedStatus,
      action,
      startedAt,
      completedAt,
      [],
      metadataStep ?? "verify"
    );
  }

  return buildFallbackPipelineSteps(
    "pending",
    action,
    startedAt,
    completedAt,
    [],
    metadataStep
  );
}

function getCurrentStage(steps: PipelineStep[]): PipelineStage {
  const runningStep = steps.find((s) => s.status === "running");
  if (runningStep) return runningStep.stage;

  const failedStep = steps.find((s) => s.status === "failed");
  if (failedStep) return failedStep.stage;

  const lastSuccess = [...steps].reverse().find((s) => s.status === "success");
  return lastSuccess?.stage ?? "commit";
}

export const pipelinesRouter = router({
  journeys: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        activeOnly: z.boolean().default(true),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const limit = input?.limit ?? 10;
      const activeOnly = input?.activeOnly ?? true;

      const statusFilter = activeOnly
        ? inArray(deploymentHistory.status, activeDeploymentStatuses)
        : undefined;

      const results = await ctx.db
        .select({
          deployment: deploymentHistory,
          app: {
            id: applications.id,
            name: applications.name,
            slug: applications.slug,
          },
        })
        .from(deploymentHistory)
        .leftJoin(applications, sql`${deploymentHistory.applicationId}::uuid = ${applications.id}`)
        .where(statusFilter)
        .orderBy(desc(deploymentHistory.startedAt))
        .limit(limit);

      return results.map(({ deployment, app }): DeploymentJourney => {
        const parsedMetadata = parseDeploymentMetadata(deployment.metadata);

        const steps = mapDeploymentStatusToSteps(
          deployment.status,
          deployment.action,
          deployment.startedAt,
          deployment.completedAt,
          deployment.metadata
        );

        return {
          id: deployment.id,
          appId: deployment.applicationId,
          appName: app?.name ?? deployment.applicationName,
          appSlug: app?.slug ?? deployment.applicationId,
          environment: deployment.environment,
          commitSha: deployment.commitSha ?? "",
          commitMessage: deployment.commitMessage ?? "",
          branch: deployment.branch ?? "main",
          triggeredBy: deployment.triggeredBy,
          startedAt: deployment.startedAt.toISOString(),
          currentStage: parseDeploymentStepFromMetadata(parsedMetadata) ?? getCurrentStage(steps),
          steps,
        };
      });
    }),

  byDeployment: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [result] = await ctx.db
        .select({
          deployment: deploymentHistory,
          app: {
            id: applications.id,
            name: applications.name,
            slug: applications.slug,
          },
        })
        .from(deploymentHistory)
        .leftJoin(applications, sql`${deploymentHistory.applicationId}::uuid = ${applications.id}`)
        .where(eq(deploymentHistory.id, input))
        .limit(1);

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }

      const { deployment, app } = result;
      const steps = mapDeploymentStatusToSteps(
        deployment.status,
        deployment.action,
        deployment.startedAt,
        deployment.completedAt,
        deployment.metadata
      );

      return {
        id: deployment.id,
        appId: deployment.applicationId,
        appName: app?.name ?? deployment.applicationName,
        appSlug: app?.slug ?? deployment.applicationId,
        environment: deployment.environment,
        commitSha: deployment.commitSha ?? "",
        commitMessage: deployment.commitMessage ?? "",
        branch: deployment.branch ?? "main",
        triggeredBy: deployment.triggeredBy,
        startedAt: deployment.startedAt.toISOString(),
        completedAt: deployment.completedAt?.toISOString(),
        status: deployment.status,
        currentStage: getCurrentStage(steps),
        steps,
        metadata: deployment.metadata ? JSON.parse(deployment.metadata) : undefined,
      };
    }),

  byApp: publicProcedure
    .input(z.object({
      appId: z.string().uuid(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const results = await ctx.db
        .select()
        .from(deploymentHistory)
        .where(eq(deploymentHistory.applicationId, input.appId))
        .orderBy(desc(deploymentHistory.startedAt))
        .limit(input.limit);

      return results.map((deployment) => {
        const steps = mapDeploymentStatusToSteps(
          deployment.status,
          deployment.action,
          deployment.startedAt,
          deployment.completedAt,
          deployment.metadata
        );

        return {
          id: deployment.id,
          environment: deployment.environment,
          commitSha: deployment.commitSha ?? "",
          commitMessage: deployment.commitMessage ?? "",
          branch: deployment.branch ?? "main",
          triggeredBy: deployment.triggeredBy,
          startedAt: deployment.startedAt.toISOString(),
          completedAt: deployment.completedAt?.toISOString(),
          status: deployment.status,
          currentStage: getCurrentStage(steps),
          steps,
        };
      });
    }),

  reportProgress: protectedProcedure
    .input(
      z.object({
        deploymentHistoryId: z.string().uuid(),
        status: deploymentProgressStatusSchema,
        action: z
          .enum(["deploy", "rollback", "scale", "sync"])
          .optional(),
        deploymentStep: z.enum(["commit", "build", "test", "deploy", "verify"]).optional(),
        metadata: z.record(z.unknown()).optional(),
        details: z.string().optional(),
        startedAt: z.string().datetime().optional(),
        completedAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [existing] = await ctx.db
        .select({ id: deploymentHistory.id, metadata: deploymentHistory.metadata })
        .from(deploymentHistory)
        .where(eq(deploymentHistory.id, input.deploymentHistoryId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }

      const metadata: Record<string, unknown> = {
        ...(existing.metadata ? (parseDeploymentMetadata(existing.metadata) ?? {}) : {}),
        ...(input.metadata ?? {}),
      };

      if (input.deploymentStep) {
        metadata.deploymentStep = input.deploymentStep;
      }

      const [updated] = await ctx.db
        .update(deploymentHistory)
        .set({
          status: input.status,
          ...(input.action ? { action: input.action } : {}),
          ...(input.details ? { details: input.details } : {}),
          ...(Object.keys(metadata).length > 0 ? { metadata: JSON.stringify(metadata) } : {}),
          ...(input.startedAt ? { startedAt: new Date(input.startedAt) } : {}),
          ...(input.completedAt ? { completedAt: new Date(input.completedAt) } : {}),
        })
        .where(eq(deploymentHistory.id, input.deploymentHistoryId))
        .returning({ id: deploymentHistory.id });

      return { id: updated?.id ?? input.deploymentHistoryId };
    }),
});

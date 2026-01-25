import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { applications, deploymentHistory, desc, eq, and, or, sql } from "@repo/db";
import { TRPCError } from "@trpc/server";

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
  currentStage: PipelineStage;
  steps: PipelineStep[];
}

function mapDeploymentStatusToSteps(
  status: string,
  action: string,
  startedAt: Date,
  completedAt: Date | null
): PipelineStep[] {
  const baseSteps: PipelineStep[] = [
    { stage: "commit", status: "success", startedAt: startedAt.toISOString() },
  ];

  if (status === "pending") {
    return [
      ...baseSteps,
      { stage: "build", status: "pending" },
      { stage: "test", status: "pending" },
      { stage: "deploy", status: "pending" },
      { stage: "verify", status: "pending" },
    ];
  }

  if (status === "running" || status === "in_progress") {
    const currentStage = action === "deploy" ? "deploy" : "build";
    return [
      ...baseSteps,
      { stage: "build", status: currentStage === "build" ? "running" : "success" },
      { stage: "test", status: currentStage === "build" ? "pending" : "running" },
      { stage: "deploy", status: currentStage === "deploy" ? "running" : "pending" },
      { stage: "verify", status: "pending" },
    ];
  }

  if (status === "succeeded" || status === "success") {
    const completedIso = completedAt?.toISOString();
    return [
      ...baseSteps,
      { stage: "build", status: "success", completedAt: completedIso },
      { stage: "test", status: "success", completedAt: completedIso },
      { stage: "deploy", status: "success", completedAt: completedIso },
      { stage: "verify", status: "success", completedAt: completedIso },
    ];
  }

  if (status === "failed") {
    const failedStage = action === "deploy" ? "deploy" : "build";
    return [
      ...baseSteps,
      { stage: "build", status: failedStage === "build" ? "failed" : "success" },
      { stage: "test", status: failedStage === "build" ? "skipped" : "success" },
      { stage: "deploy", status: failedStage === "deploy" ? "failed" : "skipped" },
      { stage: "verify", status: "skipped" },
    ];
  }

  return baseSteps;
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
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      activeOnly: z.boolean().default(true),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const limit = input?.limit ?? 10;
      const activeOnly = input?.activeOnly ?? true;

      const statusFilter = activeOnly
        ? or(
            eq(deploymentHistory.status, "pending"),
            eq(deploymentHistory.status, "running"),
            eq(deploymentHistory.status, "in_progress")
          )
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
        const steps = mapDeploymentStatusToSteps(
          deployment.status,
          deployment.action,
          deployment.startedAt,
          deployment.completedAt
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
          currentStage: getCurrentStage(steps),
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
        deployment.completedAt
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
          deployment.completedAt
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
});

/**
 * Deployments Router
 * 
 * tRPC procedures for deployment management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Types for deployment data (exported for type inference)
export interface Deployment {
  id: string;
  appId: string;
  appName: string;
  version: string;
  environment: "development" | "staging" | "production";
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  triggeredBy: string;
  commitSha: string;
  commitMessage: string;
  imageTag: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  logs?: string[];
}

// Mock data for development
const mockDeployments: Deployment[] = [
  {
    id: "deploy-1",
    appId: "app-1",
    appName: "web-frontend",
    version: "1.2.3",
    environment: "production",
    status: "succeeded",
    triggeredBy: "github-actions",
    commitSha: "abc123def",
    commitMessage: "feat: add dark mode support",
    imageTag: "registry.gmac.io/web-frontend:1.2.3",
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3300000).toISOString(),
    duration: 300,
  },
  {
    id: "deploy-2",
    appId: "app-2",
    appName: "api-gateway",
    version: "2.0.1",
    environment: "staging",
    status: "running",
    triggeredBy: "manual",
    commitSha: "def456ghi",
    commitMessage: "fix: rate limiting bug",
    imageTag: "registry.gmac.io/api-gateway:2.0.1",
    startedAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "deploy-3",
    appId: "app-3",
    appName: "auth-service",
    version: "1.0.5",
    environment: "production",
    status: "failed",
    triggeredBy: "github-actions",
    commitSha: "ghi789jkl",
    commitMessage: "chore: update dependencies",
    imageTag: "registry.gmac.io/auth-service:1.0.5",
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    completedAt: new Date(Date.now() - 7000000).toISOString(),
    duration: 200,
  },
];

export const deploymentsRouter = router({
  /**
   * Get recent deployments
   */
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      environment: z.enum(["development", "staging", "production"]).optional(),
      status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]).optional(),
      appId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      let deployments = [...mockDeployments];
      
      if (input?.environment) {
        deployments = deployments.filter((d) => d.environment === input.environment);
      }
      if (input?.status) {
        deployments = deployments.filter((d) => d.status === input.status);
      }
      if (input?.appId) {
        deployments = deployments.filter((d) => d.appId === input.appId);
      }
      
      return deployments.slice(0, input?.limit ?? 20);
    }),

  /**
   * Get a single deployment by ID
   */
  byId: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const deployment = mockDeployments.find((d) => d.id === input);
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }
      return deployment;
    }),

  /**
   * Get deployment stats
   */
  stats: publicProcedure
    .input(z.object({
      period: z.enum(["day", "week", "month"]).default("week"),
    }).optional())
    .query(async () => {
      const deployments = mockDeployments;
      const succeeded = deployments.filter((d) => d.status === "succeeded").length;
      const failed = deployments.filter((d) => d.status === "failed").length;
      const running = deployments.filter((d) => d.status === "running").length;
      
      return {
        total: deployments.length,
        succeeded,
        failed,
        running,
        pending: deployments.filter((d) => d.status === "pending").length,
        successRate: deployments.length > 0 ? Math.round((succeeded / deployments.length) * 100) : 0,
        avgDuration: Math.round(
          deployments
            .filter((d) => d.duration)
            .reduce((acc, d) => acc + (d.duration ?? 0), 0) /
            deployments.filter((d) => d.duration).length || 0
        ),
        byEnvironment: {
          production: deployments.filter((d) => d.environment === "production").length,
          staging: deployments.filter((d) => d.environment === "staging").length,
          development: deployments.filter((d) => d.environment === "development").length,
        },
      };
    }),

  /**
   * Trigger a new deployment
   */
  trigger: protectedProcedure
    .input(z.object({
      appId: z.string(),
      environment: z.enum(["development", "staging", "production"]),
      imageTag: z.string().optional(),
      commitSha: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = `deploy-${Date.now()}`;
      const deployment: Deployment = {
        id,
        appId: input.appId,
        appName: input.appId, // Would be looked up from app registry
        version: "latest",
        environment: input.environment,
        status: "pending",
        triggeredBy: "manual",
        commitSha: input.commitSha ?? "HEAD",
        commitMessage: "Manual deployment",
        imageTag: input.imageTag ?? `registry.gmac.io/${input.appId}:latest`,
        startedAt: new Date().toISOString(),
      };
      
      // In production, this would trigger the actual deployment
      return {
        success: true,
        deployment,
      };
    }),

  /**
   * Rollback a deployment
   */
  rollback: protectedProcedure
    .input(z.object({
      deploymentId: z.string(),
      targetVersion: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const deployment = mockDeployments.find((d) => d.id === input.deploymentId);
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }
      
      // In production, this would trigger the rollback
      return {
        success: true,
        message: `Rolling back ${deployment.appName} to ${input.targetVersion ?? "previous version"}`,
        rollbackDeploymentId: `deploy-rollback-${Date.now()}`,
      };
    }),

  /**
   * Cancel a running deployment
   */
  cancel: protectedProcedure
    .input(z.string())
    .mutation(async ({ input }) => {
      const deployment = mockDeployments.find((d) => d.id === input);
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }
      if (deployment.status !== "running" && deployment.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deployment is not running" });
      }
      
      // In production, this would cancel the deployment
      return {
        success: true,
        message: `Cancelled deployment ${input}`,
      };
    }),
});

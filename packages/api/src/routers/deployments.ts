/**
 * Deployments Router
 * 
 * tRPC procedures for deployment management
 * Supports multiple deployment providers (Vercel, Kubernetes, Railway, Fly.io)
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { pushSubscriptions, applications, deploymentHistory, eq, desc, and } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { getProviderRegistry } from "../providers/registry";
import type { DeployProviderType } from "../providers/deploy/types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

import type { Database } from "@repo/db";

async function getAppDeployProvider(db: Database, appId: string) {
  const registry = getProviderRegistry();
  
  const [app] = await db
    .select({ deployProvider: applications.deployProvider, name: applications.name })
    .from(applications)
    .where(eq(applications.id, appId))
    .limit(1);
  
  if (!app) {
    return { app: null, provider: null };
  }
  
  const providerType = (app.deployProvider || 'vercel') as DeployProviderType;
  
  if (!registry.hasDeployProvider(providerType)) {
    return { app, provider: null };
  }
  
  try {
    const provider = registry.getDeployProvider(providerType);
    return { app, provider };
  } catch {
    return { app, provider: null };
  }
}

function mapProviderStatus(status: string): Deployment["status"] {
  const statusMap: Record<string, Deployment["status"]> = {
    queued: "pending",
    building: "running",
    deploying: "running",
    ready: "succeeded",
    error: "failed",
    cancelled: "cancelled",
  };
  return statusMap[status] ?? "pending";
}

async function sendDeploymentPush(
  tokens: string[],
  deployment: { appName: string; environment: string; status: string; id: string }
): Promise<{ success: boolean; sent: number }> {
  if (tokens.length === 0) return { success: false, sent: 0 };

  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    running: "🚀",
    succeeded: "✅",
    failed: "❌",
    cancelled: "⏹️",
  };

  const messages = tokens.map((token) => ({
    to: token,
    title: `${statusEmoji[deployment.status] || "📦"} ${deployment.appName}`,
    body: `Deployment to ${deployment.environment} ${deployment.status}`,
    data: { deploymentId: deployment.id, type: "deployment", status: deployment.status },
    sound: deployment.status === "failed" ? "default" : "default",
    priority: "high",
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    return { success: response.ok, sent: response.ok ? tokens.length : 0 };
  } catch {
    return { success: false, sent: 0 };
  }
}

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
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      environment: z.enum(["development", "staging", "production"]).optional(),
      status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]).optional(),
      appId: z.string().optional(),
      projectId: z.string().optional(),
      demoMode: z.boolean().optional().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.demoMode) {
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
      }
      
      if (input?.appId && input?.projectId && ctx.db) {
        const { app, provider } = await getAppDeployProvider(ctx.db, input.appId);
        
        if (app && provider) {
          const response = await provider.listDeployments(input.projectId, {
            environment: input.environment,
            perPage: input.limit,
          });
          
          return response.data.map((d) => ({
            id: d.id,
            appId: input.appId!,
            appName: app.name,
            version: d.commitSha?.slice(0, 7) ?? "latest",
            environment: (d.environment ?? "production") as Deployment["environment"],
            status: mapProviderStatus(d.status),
            triggeredBy: d.triggeredBy?.name ?? "unknown",
            commitSha: d.commitSha ?? "",
            commitMessage: d.commitMessage ?? "",
            imageTag: `${app.name}:${d.commitSha?.slice(0, 7) ?? "latest"}`,
            startedAt: d.startedAt?.toISOString() ?? d.createdAt.toISOString(),
            completedAt: d.completedAt?.toISOString(),
            duration: d.startedAt && d.completedAt 
              ? Math.round((d.completedAt.getTime() - d.startedAt.getTime()) / 1000)
              : undefined,
          } as Deployment));
        }
      }
      
      if (!ctx.db) {
        return mockDeployments.slice(0, input?.limit ?? 20);
      }
      
      const conditions = [];
      
      if (input?.appId) {
        conditions.push(eq(deploymentHistory.applicationId, input.appId));
      }
      
      if (input?.environment) {
        conditions.push(eq(deploymentHistory.environment, input.environment));
      }
      
      if (input?.status) {
        const statusMap: Record<string, string> = {
          pending: "pending",
          running: "in_progress",
          succeeded: "success",
          failed: "failed",
          cancelled: "cancelled",
        };
        conditions.push(eq(deploymentHistory.status, statusMap[input.status] || input.status));
      }
      
      const dbDeployments = await ctx.db
        .select()
        .from(deploymentHistory)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(deploymentHistory.startedAt))
        .limit(input?.limit ?? 20);
      
      return dbDeployments.map((d): Deployment => {
        const statusMap: Record<string, Deployment["status"]> = {
          pending: "pending",
          in_progress: "running",
          success: "succeeded",
          failed: "failed",
          cancelled: "cancelled",
        };
        
        const duration = d.startedAt && d.completedAt
          ? Math.round((d.completedAt.getTime() - d.startedAt.getTime()) / 1000)
          : undefined;
        
        return {
          id: d.id,
          appId: d.applicationId,
          appName: d.applicationName,
          version: d.version || "latest",
          environment: d.environment as Deployment["environment"],
          status: statusMap[d.status] || "pending",
          triggeredBy: d.triggeredBy,
          commitSha: d.commitSha || "",
          commitMessage: d.commitMessage || "",
          imageTag: d.image || `${d.applicationName}:${d.version || "latest"}`,
          startedAt: d.startedAt.toISOString(),
          completedAt: d.completedAt?.toISOString(),
          duration,
        };
      });
    }),

  byId: publicProcedure
    .input(z.object({
      deploymentId: z.string(),
      appId: z.string().optional(),
    }).or(z.string()))
    .query(async ({ ctx, input }) => {
      const deploymentId = typeof input === 'string' ? input : input.deploymentId;
      const appId = typeof input === 'string' ? undefined : input.appId;
      
      if (appId && ctx.db) {
        const { app, provider } = await getAppDeployProvider(ctx.db, appId);
        
        if (app && provider) {
          try {
            const d = await provider.getDeployment(deploymentId);
            return {
              id: d.id,
              appId: appId,
              appName: app.name,
              version: d.commitSha?.slice(0, 7) ?? "latest",
              environment: (d.environment ?? "production") as Deployment["environment"],
              status: mapProviderStatus(d.status),
              triggeredBy: d.triggeredBy?.name ?? "unknown",
              commitSha: d.commitSha ?? "",
              commitMessage: d.commitMessage ?? "",
              imageTag: `${app.name}:${d.commitSha?.slice(0, 7) ?? "latest"}`,
              startedAt: d.startedAt?.toISOString() ?? d.createdAt.toISOString(),
              completedAt: d.completedAt?.toISOString(),
              duration: d.startedAt && d.completedAt 
                ? Math.round((d.completedAt.getTime() - d.startedAt.getTime()) / 1000)
                : undefined,
            } as Deployment;
          } catch {
            throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
          }
        }
      }
      
      const deployment = mockDeployments.find((d) => d.id === deploymentId);
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

  trigger: protectedProcedure
    .input(z.object({
      appId: z.string(),
      environment: z.enum(["development", "staging", "production"]),
      imageTag: z.string().optional(),
      commitSha: z.string().optional(),
      projectId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }
      
      const { app, provider } = await getAppDeployProvider(ctx.db, input.appId);
      
      if (!app) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }
      
      if (provider && input.projectId) {
        const providerDeployment = await provider.deploy(input.projectId, {
          environment: input.environment,
          commitSha: input.commitSha,
        });
        
        return {
          success: true,
          deployment: {
            id: providerDeployment.id,
            appId: input.appId,
            appName: app.name,
            version: providerDeployment.commitSha?.slice(0, 7) ?? "latest",
            environment: input.environment,
            status: mapProviderStatus(providerDeployment.status),
            triggeredBy: providerDeployment.triggeredBy?.name ?? "manual",
            commitSha: providerDeployment.commitSha ?? "HEAD",
            commitMessage: providerDeployment.commitMessage ?? "Deployment triggered",
            imageTag: input.imageTag ?? `${app.name}:latest`,
            startedAt: providerDeployment.startedAt?.toISOString() ?? new Date().toISOString(),
            completedAt: providerDeployment.completedAt?.toISOString(),
          } as Deployment,
          provider: provider.type,
        };
      }
      
      const id = `deploy-${Date.now()}`;
      const deployment: Deployment = {
        id,
        appId: input.appId,
        appName: app.name,
        version: "latest",
        environment: input.environment,
        status: "pending",
        triggeredBy: "manual",
        commitSha: input.commitSha ?? "HEAD",
        commitMessage: "Manual deployment",
        imageTag: input.imageTag ?? `registry.gmac.io/${input.appId}:latest`,
        startedAt: new Date().toISOString(),
      };
      
      return {
        success: true,
        deployment,
        provider: null,
      };
    }),

  rollback: protectedProcedure
    .input(z.object({
      appId: z.string().optional(),
      projectId: z.string().optional(),
      deploymentId: z.string(),
      targetVersion: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }
      
      if (input.appId && input.projectId) {
        const { app, provider } = await getAppDeployProvider(ctx.db, input.appId);
        
        if (!app) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }
        
        if (provider) {
          const rollbackDeployment = await provider.rollback(input.projectId, {
            targetDeploymentId: input.deploymentId,
          });
          
          return {
            success: true,
            message: `Rolling back ${app.name} to deployment ${input.deploymentId}`,
            rollbackDeploymentId: rollbackDeployment.id,
            provider: provider.type,
          };
        }
      }
      
      const deployment = mockDeployments.find((d) => d.id === input.deploymentId);
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }
      
      return {
        success: true,
        message: `Rolling back ${deployment.appName} to ${input.targetVersion ?? "previous version"}`,
        rollbackDeploymentId: `deploy-rollback-${Date.now()}`,
        provider: null,
      };
    }),

  cancel: protectedProcedure
    .input(z.object({
      deploymentId: z.string(),
      appId: z.string().optional(),
    }).or(z.string()))
    .mutation(async ({ ctx, input }) => {
      const deploymentId = typeof input === 'string' ? input : input.deploymentId;
      const appId = typeof input === 'string' ? undefined : input.appId;
      
      if (appId && ctx.db) {
        const { app, provider } = await getAppDeployProvider(ctx.db, appId);
        
        if (app && provider) {
          await provider.cancelDeployment(deploymentId);
          return {
            success: true,
            message: `Cancelled deployment ${deploymentId}`,
            provider: provider.type,
          };
        }
      }
      
      const deployment = mockDeployments.find((d) => d.id === deploymentId);
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }
      if (deployment.status !== "running" && deployment.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deployment is not running" });
      }
      
      return {
        success: true,
        message: `Cancelled deployment ${deploymentId}`,
        provider: null,
      };
    }),

  triggerDeploymentPush: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const deployment = mockDeployments.find((d) => d.id === input);
      if (!deployment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
      }

      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const subscriptions = await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.active, true));

      const tokens = subscriptions.map((s) => s.pushToken);
      const result = await sendDeploymentPush(tokens, deployment);

      return {
        success: result.success,
        sent: result.sent,
        appName: deployment.appName,
        status: deployment.status,
      };
    }),
});

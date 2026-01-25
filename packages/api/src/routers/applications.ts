/**
 * Applications Router
 * 
 * tRPC procedures for application management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { applications, notifications, desc, eq, and, sql } from "@repo/db";
import { TRPCError } from "@trpc/server";

export const applicationsRouter = router({
  /**
   * Get all applications
   */
  list: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const results = await ctx.db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt));

      return results.map((app) => ({
        ...app,
        createdAt: app.createdAt, // Already a Date in PostgreSQL
        updatedAt: app.updatedAt, // Already a Date in PostgreSQL
      }));
    }),

  /**
   * Get a single application by ID
   */
  byId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.id, input))
        .limit(1);

      const app = result[0];
      if (!app) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      return {
        ...app,
        createdAt: app.createdAt, // Already a Date in PostgreSQL
        updatedAt: app.updatedAt, // Already a Date in PostgreSQL
      };
    }),

  /**
   * Get application by slug
   */
  bySlug: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.slug, input))
        .limit(1);

      const app = result[0];
      if (!app) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      return {
        ...app,
        createdAt: app.createdAt, // Already a Date in PostgreSQL
        updatedAt: app.updatedAt, // Already a Date in PostgreSQL
      };
    }),

  /**
   * Get all applications with health status based on notifications
   */
  listWithHealth: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get all applications
      const apps = await ctx.db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt));

      // Get active notifications (last 24h, not resolved)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeNotifications = await ctx.db
        .select()
        .from(notifications)
        .where(
          and(
            sql`${notifications.createdAt} > ${oneDayAgo}`,
            sql`${notifications.status} != 'resolved'`
          )
        );

      // Aggregate per application
      return apps.map((app) => {
        const appNotifications = activeNotifications.filter(
          (n) => n.appId === app.id
        );
        
        const criticalCount = appNotifications.filter(
          (n) => n.severity === 'critical'
        ).length;
        const warningCount = appNotifications.filter(
          (n) => n.severity === 'warning'
        ).length;

        const status: 'critical' | 'warning' | 'healthy' = 
          criticalCount > 0 ? 'critical' :
          warningCount > 0 ? 'warning' : 'healthy';

        const latestNotification = appNotifications
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        return {
          id: app.id,
          name: app.name,
          slug: app.slug,
          description: app.description,
          repositoryUrl: app.repositoryUrl,
          status,
          appStatus: app.status,
          alertCounts: { critical: criticalCount, warning: warningCount },
          latestAlert: latestNotification ? {
            message: latestNotification.message,
            severity: latestNotification.severity as 'critical' | 'warning',
            timestamp: latestNotification.createdAt,
          } : null,
          lastActivity: latestNotification?.createdAt ?? app.updatedAt,
          gitProvider: app.gitProvider,
          deployProvider: app.deployProvider,
          dbProvider: app.dbProvider,
          isDeploying: app.status === 'deploying',
        };
      }).sort((a, b) => {
        // Sort by status severity (critical > warning > healthy)
        const statusOrder = { critical: 0, warning: 1, healthy: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        // Then by most recent activity
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      repositoryUrl: z.string().optional(),
      gitProvider: z.enum(["github", "gitea", "gitlab"]).optional().default("github"),
      deployProvider: z.enum(["vercel", "kubernetes", "railway", "flyio"]).optional().default("vercel"),
      dbProvider: z.enum(["neon", "turso", "supabase", "planetscale"]).optional().default("neon"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      const [inserted] = await ctx.db.insert(applications).values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        repositoryUrl: input.repositoryUrl || null,
        gitProvider: input.gitProvider,
        deployProvider: input.deployProvider,
        dbProvider: input.dbProvider,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }).returning();

      return inserted;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      repositoryUrl: z.string().optional(),
      localRepoPath: z.string().optional(),
      status: z.string().optional(),
      gitProvider: z.enum(["github", "gitea", "gitlab"]).optional(),
      deployProvider: z.enum(["vercel", "kubernetes", "railway", "flyio"]).optional(),
      dbProvider: z.enum(["neon", "turso", "supabase", "planetscale"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const existing = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.id, input.id))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.repositoryUrl !== undefined) updateData.repositoryUrl = input.repositoryUrl;
      if (input.localRepoPath !== undefined) updateData.localRepoPath = input.localRepoPath;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.gitProvider !== undefined) updateData.gitProvider = input.gitProvider;
      if (input.deployProvider !== undefined) updateData.deployProvider = input.deployProvider;
      if (input.dbProvider !== undefined) updateData.dbProvider = input.dbProvider;

      const [updated] = await ctx.db
        .update(applications)
        .set(updateData)
        .where(eq(applications.id, input.id))
        .returning();

      return updated;
    }),
});

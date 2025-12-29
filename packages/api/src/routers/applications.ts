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
          status,
          alertCounts: { critical: criticalCount, warning: warningCount },
          latestAlert: latestNotification ? {
            message: latestNotification.message,
            severity: latestNotification.severity as 'critical' | 'warning',
            timestamp: latestNotification.createdAt,
          } : null,
          lastActivity: latestNotification?.createdAt ?? app.updatedAt,
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

  /**
   * Create a new application
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      repositoryUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      await ctx.db.insert(applications).values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        repositoryUrl: input.repositoryUrl || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      return { ...input, status: "active", createdAt: now, updatedAt: now };
    }),
});

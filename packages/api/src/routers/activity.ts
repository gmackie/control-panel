/**
 * Activity Router
 * 
 * tRPC procedures for activity feed
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { activityEvents, desc, gte, sql } from "@repo/db";
import { TRPCError } from "@trpc/server";

export const activityRouter = router({
  /**
   * Get recent activity events
   */
  recent: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const limit = input?.limit ?? 20;

      const results = await ctx.db
        .select()
        .from(activityEvents)
        .orderBy(desc(activityEvents.timestamp))
        .limit(limit);

      return results.map((event) => ({
        ...event,
        timestamp: event.timestamp, // Already a Date in PostgreSQL
        links: event.links ? JSON.parse(event.links) : undefined,
        metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
      }));
    }),

  /**
   * Get activity stats
   */
  stats: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [totalResult, last24hResult, last7dResult, bySeverity] = await Promise.all([
        ctx.db.select({ count: sql<number>`count(*)` }).from(activityEvents),
        ctx.db.select({ count: sql<number>`count(*)` }).from(activityEvents).where(gte(activityEvents.timestamp, last24h)),
        ctx.db.select({ count: sql<number>`count(*)` }).from(activityEvents).where(gte(activityEvents.timestamp, last7d)),
        ctx.db.select({ severity: activityEvents.severity, count: sql<number>`count(*)` }).from(activityEvents).groupBy(activityEvents.severity),
      ]);

      const severityMap: Record<string, number> = {};
      bySeverity.forEach((row) => {
        severityMap[row.severity] = row.count;
      });

      return {
        total: totalResult[0]?.count || 0,
        last24h: last24hResult[0]?.count || 0,
        last7d: last7dResult[0]?.count || 0,
        bySeverity: severityMap,
      };
    }),
});

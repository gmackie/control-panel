/**
 * Notifications Router
 * 
 * tRPC procedures for notification management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { notifications, pushSubscriptions } from "@repo/db";
import { desc, eq, and, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const notificationsRouter = router({
  /**
   * Get notifications list
   */
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      statuses: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = [];
      
      if (input?.statuses && input.statuses.length > 0) {
        conditions.push(inArray(notifications.status, input.statuses));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [results, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(notifications)
          .where(whereClause)
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(notifications)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count || 0;

      return {
        notifications: results.map((n) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        })),
        total,
        hasMore: offset + results.length < total,
      };
    }),

  /**
   * Get a single notification by ID
   */
  byId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select()
        .from(notifications)
        .where(eq(notifications.id, input))
        .limit(1);

      const notification = result[0];
      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }

      return {
        ...notification,
        createdAt: new Date(notification.createdAt),
        updatedAt: new Date(notification.updatedAt),
      };
    }),

  /**
   * Get unread count
   */
  unreadCount: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(eq(notifications.status, "new"));

      return result[0]?.count || 0;
    }),

  /**
   * Get notification stats
   */
  stats: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [totalResult, unreadResult, last24hResult, last7dResult] = await Promise.all([
        ctx.db.select({ count: sql<number>`count(*)` }).from(notifications),
        ctx.db.select({ count: sql<number>`count(*)` }).from(notifications).where(eq(notifications.status, "new")),
        ctx.db.select({ count: sql<number>`count(*)` }).from(notifications).where(gte(notifications.createdAt, last24h.toISOString())),
        ctx.db.select({ count: sql<number>`count(*)` }).from(notifications).where(gte(notifications.createdAt, last7d.toISOString())),
      ]);

      return {
        total: totalResult[0]?.count || 0,
        unread: unreadResult[0]?.count || 0,
        last24h: last24hResult[0]?.count || 0,
        last7d: last7dResult[0]?.count || 0,
      };
    }),

  /**
   * Mark notification as read
   */
  markAsRead: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      await ctx.db
        .update(notifications)
        .set({
          status: "seen",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(notifications.id, input));

      return { success: true };
    }),

  /**
   * Mark all as read
   */
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .update(notifications)
        .set({
          status: "seen",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(notifications.status, "new"));

      return { 
        success: true, 
        count: result.rowsAffected || 0 
      };
    }),

  /**
   * Register push notification token
   */
  registerPushToken: protectedProcedure
    .input(z.object({
      pushToken: z.string(),
      deviceId: z.string(),
      deviceName: z.string().optional(),
      platform: z.enum(["ios", "android"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date().toISOString();
      const id = `push_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Check if device already registered
      const existing = await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.deviceId, input.deviceId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing subscription
        await ctx.db
          .update(pushSubscriptions)
          .set({
            pushToken: input.pushToken,
            deviceName: input.deviceName,
            active: 1,
            lastUsedAt: now,
            updatedAt: now,
          })
          .where(eq(pushSubscriptions.deviceId, input.deviceId));
        
        return { success: true, id: existing[0]!.id, updated: true };
      }

      // Create new subscription
      await ctx.db.insert(pushSubscriptions).values({
        id,
        userId: "default", // In a real app, get from auth context
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        platform: input.platform,
        pushToken: input.pushToken,
        active: 1,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id, updated: false };
    }),

  /**
   * Unregister push notification token
   */
  unregisterPushToken: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      await ctx.db
        .update(pushSubscriptions)
        .set({
          active: 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushSubscriptions.deviceId, input));

      return { success: true };
    }),
});

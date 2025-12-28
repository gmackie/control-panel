/**
 * Notifications Router
 * 
 * tRPC procedures for notification management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { notifications, pushSubscriptions, notificationPreferences, desc, eq, and, gte, inArray, sql } from "@repo/db";
import { TRPCError } from "@trpc/server";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  priority?: string;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ success: boolean; error?: string }> {
  if (messages.length === 0) {
    return { success: false, error: "No messages to send" };
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Expo Push error: ${response.status} - ${error}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

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
          createdAt: n.createdAt, // Already a Date in PostgreSQL
          updatedAt: n.updatedAt, // Already a Date in PostgreSQL
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
        createdAt: notification.createdAt, // Already a Date in PostgreSQL
        updatedAt: notification.updatedAt, // Already a Date in PostgreSQL
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
        ctx.db.select({ count: sql<number>`count(*)` }).from(notifications).where(gte(notifications.createdAt, last24h)),
        ctx.db.select({ count: sql<number>`count(*)` }).from(notifications).where(gte(notifications.createdAt, last7d)),
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
          updatedAt: new Date(),
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
          updatedAt: new Date(),
        })
        .where(eq(notifications.status, "new"));

      return { 
        success: true, 
        count: result.rowCount ?? 0 
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

      const now = new Date();
      
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
            active: true,
            lastUsedAt: now,
            updatedAt: now,
          })
          .where(eq(pushSubscriptions.deviceId, input.deviceId));
        
        return { success: true, id: existing[0]!.id, updated: true };
      }

      // Create new subscription - let DB generate the id
      await ctx.db.insert(pushSubscriptions).values({
        userId: "default", // In a real app, get from auth context
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        platform: input.platform,
        pushToken: input.pushToken,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, updated: false };
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
          active: false,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.deviceId, input));

      return { success: true };
    }),

  /**
   * Get notification preferences for current user
   */
  getPreferences: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const userId = ctx.userId ?? "default";

      const result = await ctx.db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return {
          emailEnabled: true,
          slackEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          categoryPreferences: {
            alerts: true,
            deployments: true,
            security: true,
            system: true,
          },
          quietHours: {
            enabled: false,
            start: "22:00",
            end: "08:00",
          },
        };
      }

      const prefs = result[0]!;
      return {
        emailEnabled: prefs.emailEnabled,
        slackEnabled: prefs.slackEnabled,
        pushEnabled: prefs.pushEnabled,
        inAppEnabled: prefs.inAppEnabled,
        categoryPreferences: prefs.categoryPreferences
          ? JSON.parse(prefs.categoryPreferences)
          : { alerts: true, deployments: true, security: true, system: true },
        quietHours: prefs.quietHours
          ? JSON.parse(prefs.quietHours)
          : { enabled: false, start: "22:00", end: "08:00" },
      };
    }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(z.object({
      emailEnabled: z.boolean().optional(),
      slackEnabled: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      inAppEnabled: z.boolean().optional(),
      categoryPreferences: z.object({
        alerts: z.boolean().optional(),
        deployments: z.boolean().optional(),
        security: z.boolean().optional(),
        system: z.boolean().optional(),
      }).optional(),
      quietHours: z.object({
        enabled: z.boolean(),
        start: z.string(),
        end: z.string(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const userId = ctx.userId ?? "default";
      const now = new Date();

      const existing = await ctx.db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.emailEnabled !== undefined) updateData.emailEnabled = input.emailEnabled;
      if (input.slackEnabled !== undefined) updateData.slackEnabled = input.slackEnabled;
      if (input.pushEnabled !== undefined) updateData.pushEnabled = input.pushEnabled;
      if (input.inAppEnabled !== undefined) updateData.inAppEnabled = input.inAppEnabled;
      if (input.categoryPreferences) {
        const existingCat = existing[0]?.categoryPreferences
          ? JSON.parse(existing[0].categoryPreferences)
          : {};
        updateData.categoryPreferences = JSON.stringify({
          ...existingCat,
          ...input.categoryPreferences,
        });
      }
      if (input.quietHours) {
        updateData.quietHours = JSON.stringify(input.quietHours);
      }

      if (existing.length > 0) {
        await ctx.db
          .update(notificationPreferences)
          .set(updateData)
          .where(eq(notificationPreferences.userId, userId));
      } else {
        await ctx.db.insert(notificationPreferences).values({
          userId,
          emailEnabled: input.emailEnabled ?? true,
          slackEnabled: input.slackEnabled ?? true,
          pushEnabled: input.pushEnabled ?? true,
          inAppEnabled: input.inAppEnabled ?? true,
          categoryPreferences: input.categoryPreferences
            ? JSON.stringify(input.categoryPreferences)
            : JSON.stringify({ alerts: true, deployments: true, security: true, system: true }),
          quietHours: input.quietHours
            ? JSON.stringify(input.quietHours)
            : JSON.stringify({ enabled: false, start: "22:00", end: "08:00" }),
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true };
    }),

  /**
   * Send push notification to all registered devices
   */
  sendPush: protectedProcedure
    .input(z.object({
      title: z.string(),
      body: z.string(),
      data: z.record(z.unknown()).optional(),
      userId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const conditions = [eq(pushSubscriptions.active, true)];
      if (input.userId) {
        conditions.push(eq(pushSubscriptions.userId, input.userId));
      }

      const subscriptions = await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(and(...conditions));

      if (subscriptions.length === 0) {
        return { success: false, sent: 0, error: "No active push subscriptions" };
      }

      const messages: ExpoPushMessage[] = subscriptions.map((sub) => ({
        to: sub.pushToken,
        title: input.title,
        body: input.body,
        data: input.data,
        sound: "default",
        priority: "high",
      }));

      const result = await sendExpoPush(messages);

      return {
        success: result.success,
        sent: result.success ? messages.length : 0,
        error: result.error,
      };
    }),

  /**
   * Send push for a specific notification
   */
  sendPushForNotification: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const notification = await ctx.db
        .select()
        .from(notifications)
        .where(eq(notifications.id, input))
        .limit(1);

      if (notification.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }

      const notif = notification[0]!;

      const conditions = [eq(pushSubscriptions.active, true)];
      if (notif.userId) {
        conditions.push(eq(pushSubscriptions.userId, notif.userId));
      }

      const subscriptions = await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(and(...conditions));

      if (subscriptions.length === 0) {
        return { success: false, sent: 0, error: "No active push subscriptions" };
      }

      const severityEmoji: Record<string, string> = {
        info: "ℹ️",
        warning: "⚠️",
        error: "❌",
        critical: "🚨",
      };

      const emoji = severityEmoji[notif.severity] || "🔔";

      const messages: ExpoPushMessage[] = subscriptions.map((sub) => ({
        to: sub.pushToken,
        title: `${emoji} ${notif.title}`,
        body: notif.message,
        data: {
          notificationId: notif.id,
          category: notif.category,
          severity: notif.severity,
          appId: notif.appId || "",
        },
        sound: notif.severity === "critical" ? "default" : "default",
        priority: "high",
      }));

      const result = await sendExpoPush(messages);

      return {
        success: result.success,
        sent: result.success ? messages.length : 0,
        error: result.error,
      };
    }),
});

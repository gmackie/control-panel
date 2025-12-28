/**
 * Push Notification Channel
 * 
 * Delivers push notifications via Expo Push Service
 * (Prepares for mobile app in Phase 3)
 */

import { Notification, PushMessage, DeliveryResult, PushSubscription } from "../types";
import { getDbAsync } from "@/lib/db";
import { pushSubscriptions } from "@repo/db";
import { eq, and } from "drizzle-orm";

// Expo Push API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Build push message from notification
 */
function buildPushMessage(notification: Notification): PushMessage {
  const severityEmoji: Record<string, string> = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    critical: "🚨",
  };

  const emoji = severityEmoji[notification.severity] || "🔔";

  return {
    title: `${emoji} ${notification.title}`,
    body: notification.message,
    data: {
      notificationId: notification.id,
      source: notification.source,
      category: notification.category,
      severity: notification.severity,
      appId: notification.appId || "",
      url: notification.links?.[0]?.url || "",
    },
    badge: 1,
    sound: notification.severity === "critical" ? "critical.wav" : "default",
  };
}

/**
 * Get active push subscriptions for a user
 * Note: PostgreSQL returns boolean and Date types directly
 */
export async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  const db = await getDbAsync();
  if (!db) return [];

  const results = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.active, true)
      )
    );

  return results.map((r) => ({
    id: r.id,
    userId: r.userId,
    deviceId: r.deviceId,
    deviceName: r.deviceName || undefined,
    platform: r.platform as "ios" | "android" | "web",
    pushToken: r.pushToken,
    active: r.active,
    lastUsedAt: r.lastUsedAt || undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Send push notification via Expo
 */
async function sendViaExpo(
  pushTokens: string[],
  message: PushMessage
): Promise<DeliveryResult[]> {
  if (pushTokens.length === 0) {
    return [];
  }

  const messages = pushTokens.map((token) => ({
    to: token,
    title: message.title,
    body: message.body,
    data: message.data,
    badge: message.badge,
    sound: message.sound,
    priority: "high",
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const error = await response.text();
      return pushTokens.map(() => ({
        channel: "push" as const,
        success: false,
        error: `Expo Push error: ${response.status} - ${error}`,
        timestamp: new Date(),
      }));
    }

    const result = await response.json();
    const data = result.data as Array<{ status: string; id?: string; message?: string }>;

    return data.map((item) => ({
      channel: "push" as const,
      success: item.status === "ok",
      error: item.status !== "ok" ? item.message : undefined,
      messageId: item.id,
      timestamp: new Date(),
    }));
  } catch (error) {
    return pushTokens.map(() => ({
      channel: "push" as const,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    }));
  }
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  notification: Notification,
  userId: string
): Promise<DeliveryResult> {
  const subscriptions = await getUserPushSubscriptions(userId);

  if (subscriptions.length === 0) {
    return {
      channel: "push",
      success: false,
      error: "No active push subscriptions for user",
      timestamp: new Date(),
    };
  }

  const pushTokens = subscriptions.map((s) => s.pushToken);
  const message = buildPushMessage(notification);
  
  const results = await sendViaExpo(pushTokens, message);

  // Return success if at least one push succeeded
  const successfulResults = results.filter((r) => r.success);
  
  if (successfulResults.length > 0) {
    return {
      channel: "push",
      success: true,
      messageId: successfulResults[0].messageId,
      timestamp: new Date(),
    };
  }

  return {
    channel: "push",
    success: false,
    error: results[0]?.error || "All push deliveries failed",
    timestamp: new Date(),
  };
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  notification: Notification,
  userIds: string[]
): Promise<Map<string, DeliveryResult>> {
  const results = new Map<string, DeliveryResult>();

  await Promise.all(
    userIds.map(async (userId) => {
      const result = await sendPushNotification(notification, userId);
      results.set(userId, result);
    })
  );

  return results;
}

/**
 * Register a push subscription
 */
export async function registerPushSubscription(
  userId: string,
  deviceId: string,
  pushToken: string,
  platform: "ios" | "android" | "web",
  deviceName?: string
): Promise<PushSubscription> {
  const db = await getDbAsync();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const id = `push_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

  // Check if subscription exists for this device
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.deviceId, deviceId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing subscription
    await db
      .update(pushSubscriptions)
      .set({
        pushToken,
        platform,
        deviceName: deviceName || null,
        active: true,
        updatedAt: now,
      })
      .where(eq(pushSubscriptions.id, existing[0].id));

    return {
      id: existing[0].id,
      userId,
      deviceId,
      deviceName,
      platform,
      pushToken,
      active: true,
      createdAt: existing[0].createdAt,
      updatedAt: now,
    };
  }

  // Create new subscription
  const record = {
    id,
    userId,
    deviceId,
    deviceName: deviceName || null,
    platform,
    pushToken,
    active: true,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(pushSubscriptions).values(record);

  return {
    id,
    userId,
    deviceId,
    deviceName,
    platform,
    pushToken,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Unregister a push subscription
 */
export async function unregisterPushSubscription(
  userId: string,
  deviceId: string
): Promise<boolean> {
  const db = await getDbAsync();
  if (!db) throw new Error("Database not available");

  const result = await db
    .update(pushSubscriptions)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.deviceId, deviceId)
      )
    );

  return (result.rowCount ?? 0) > 0;
}

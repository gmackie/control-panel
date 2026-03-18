/**
 * Notification Service
 * 
 * Core service for managing notifications - CRUD, delivery, and real-time updates
 */

import { getDbAsync } from "@/lib/db";
import { 
  notifications, 
  notificationRules,
  notificationPreferences,
  notificationDeliveryLog,
  NotificationRecord,
  NotificationRule as NotificationRuleRecord,
  NotificationPreference as NotificationPreferencesRecord,
} from "@repo/db";
import { desc, eq, and, or, gte, lte, like, sql, inArray } from "drizzle-orm";
import {
  Notification,
  CreateNotification,
  NotificationFilter,
  NotificationQueryResult,
  NotificationStats,
  NotificationStatus,
  NotificationSeverity,
  NotificationCategory,
  NotificationRule,
  NotificationPreferences,
  DeliveryResult,
} from "./types";

// In-memory pub/sub for real-time updates
type Subscriber = (notification: Notification) => void;
const subscribers = new Set<Subscriber>();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string | null | undefined, recordType: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new Error(`${recordType} insert returned a non-UUID id`);
  }

  return value;
}

/**
 * Convert database record to Notification
 * Note: PostgreSQL returns Date objects directly for timestamp columns
 */
function recordToNotification(record: NotificationRecord): Notification {
  return {
    id: record.id,
    createdAt: record.createdAt, // Already a Date in PostgreSQL
    updatedAt: record.updatedAt, // Already a Date in PostgreSQL
    source: record.source,
    sourceEventId: record.sourceEventId || undefined,
    activityEventId: record.activityEventId || undefined,
    category: record.category as NotificationCategory,
    severity: record.severity as NotificationSeverity,
    title: record.title,
    message: record.message,
    appId: record.appId || undefined,
    appName: record.appName || undefined,
    environment: record.environment || undefined,
    actions: record.actions ? JSON.parse(record.actions) : undefined,
    links: record.links ? JSON.parse(record.links) : undefined,
    status: record.status as NotificationStatus,
    acknowledgedBy: record.acknowledgedBy || undefined,
    acknowledgedAt: record.acknowledgedAt || undefined, // Already a Date or null
    resolvedBy: record.resolvedBy || undefined,
    resolvedAt: record.resolvedAt || undefined, // Already a Date or null
    snoozedUntil: record.snoozedUntil || undefined, // Already a Date or null
    groupKey: record.groupKey || undefined,
    groupCount: record.groupCount || 1,
    deliveredVia: record.deliveredVia ? JSON.parse(record.deliveredVia) : [],
    userId: record.userId || undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
  };
}

/**
 * Convert database record to NotificationRule
 * Note: PostgreSQL returns Date and boolean types directly
 */
function recordToRule(record: NotificationRuleRecord): NotificationRule {
  return {
    id: record.id,
    name: record.name,
    description: record.description || undefined,
    enabled: record.enabled, // Already a boolean in PostgreSQL
    priority: record.priority,
    conditions: JSON.parse(record.conditions),
    channels: JSON.parse(record.channels),
    dedupe: record.dedupe ? JSON.parse(record.dedupe) : undefined,
    schedule: record.schedule ? JSON.parse(record.schedule) : undefined,
    createdAt: record.createdAt, // Already a Date in PostgreSQL
    updatedAt: record.updatedAt, // Already a Date in PostgreSQL
    createdBy: record.createdBy || undefined,
  };
}

/**
 * Convert database record to NotificationPreferences
 * Note: PostgreSQL returns Date and boolean types directly
 */
function recordToPreferences(record: NotificationPreferencesRecord): NotificationPreferences {
  return {
    id: record.id,
    userId: record.userId,
    emailEnabled: record.emailEnabled, // Already a boolean in PostgreSQL
    slackEnabled: record.slackEnabled, // Already a boolean in PostgreSQL
    pushEnabled: record.pushEnabled, // Already a boolean in PostgreSQL
    inAppEnabled: record.inAppEnabled, // Already a boolean in PostgreSQL
    categoryPreferences: record.categoryPreferences ? JSON.parse(record.categoryPreferences) : {},
    quietHours: record.quietHours ? JSON.parse(record.quietHours) : undefined,
    emailDigest: record.emailDigest ? JSON.parse(record.emailDigest) : undefined,
    createdAt: record.createdAt, // Already a Date in PostgreSQL
    updatedAt: record.updatedAt, // Already a Date in PostgreSQL
  };
}

export class NotificationService {
  // ===================================
  // Notification CRUD
  // ===================================

  /**
   * Create a new notification
   */
  async create(input: CreateNotification): Promise<Notification> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    const record = {
      createdAt: now,
      updatedAt: now,
      source: input.source,
      sourceEventId: input.sourceEventId || null,
      activityEventId: input.activityEventId || null,
      category: input.category,
      severity: input.severity,
      title: input.title,
      message: input.message,
      appId: input.appId || null,
      appName: input.appName || null,
      environment: input.environment || null,
      actions: input.actions ? JSON.stringify(input.actions) : null,
      links: input.links ? JSON.stringify(input.links) : null,
      status: "new" as const,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      snoozedUntil: null,
      groupKey: input.groupKey || null,
      groupCount: 1,
      deliveredVia: JSON.stringify([]),
      userId: input.userId || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    };

    const [insertedNotification] = await db
      .insert(notifications)
      .values(record)
      .returning();

    const notification = recordToNotification({
      ...insertedNotification,
      id: requireUuid(insertedNotification?.id, "notification"),
    } as NotificationRecord);
    
    // Publish to subscribers for real-time updates
    this.publish(notification);

    return notification;
  }

  /**
   * Get notification by ID
   */
  async getById(id: string): Promise<Notification | null> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (results.length === 0) return null;
    return recordToNotification(results[0]);
  }

  /**
   * Query notifications with filters
   */
  async query(filter: NotificationFilter = {}): Promise<NotificationQueryResult> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const {
      sources,
      categories,
      severities,
      statuses,
      appIds,
      userId,
      startDate,
      endDate,
      search,
      limit = 50,
      offset = 0,
    } = filter;

    const conditions = [];

    if (sources && sources.length > 0) {
      conditions.push(inArray(notifications.source, sources));
    }
    if (categories && categories.length > 0) {
      conditions.push(inArray(notifications.category, categories));
    }
    if (severities && severities.length > 0) {
      conditions.push(inArray(notifications.severity, severities));
    }
    if (statuses && statuses.length > 0) {
      conditions.push(inArray(notifications.status, statuses));
    }
    if (appIds && appIds.length > 0) {
      conditions.push(inArray(notifications.appId, appIds));
    }
    if (userId) {
      conditions.push(
        or(
          eq(notifications.userId, userId),
          sql`${notifications.userId} IS NULL`
        )
      );
    }
    if (startDate) {
      conditions.push(gte(notifications.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(notifications.createdAt, endDate));
    }
    if (search) {
      conditions.push(
        or(
          like(notifications.title, `%${search}%`),
          like(notifications.message, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // Get unread count
    const unreadConditions = [...conditions, eq(notifications.status, "new")];
    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...unreadConditions));
    const unreadCount = unreadResult[0]?.count || 0;

    // Get notifications
    const results = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const notificationList = results.map(recordToNotification);
    const hasMore = offset + notificationList.length < total;

    return {
      notifications: notificationList,
      total,
      unreadCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId?: string): Promise<number> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const conditions = [eq(notifications.status, "new")];
    if (userId) {
      conditions.push(
        or(
          eq(notifications.userId, userId),
          sql`${notifications.userId} IS NULL`
        )!
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  /**
   * Update notification status
   */
  async updateStatus(
    id: string,
    status: NotificationStatus,
    userId?: string
  ): Promise<Notification | null> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === "acknowledged") {
      updates.acknowledgedBy = userId || null;
      updates.acknowledgedAt = now;
    } else if (status === "resolved") {
      updates.resolvedBy = userId || null;
      updates.resolvedAt = now;
    }

    await db
      .update(notifications)
      .set(updates)
      .where(eq(notifications.id, id));

    return this.getById(id);
  }

  /**
   * Snooze a notification
   */
  async snooze(id: string, until: Date): Promise<Notification | null> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    await db
      .update(notifications)
      .set({
        status: "snoozed",
        snoozedUntil: until,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, id));

    return this.getById(id);
  }

  /**
   * Bulk update status
   */
  async bulkUpdateStatus(
    ids: string[],
    status: NotificationStatus,
    userId?: string
  ): Promise<number> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === "acknowledged") {
      updates.acknowledgedBy = userId || null;
      updates.acknowledgedAt = now;
    } else if (status === "resolved") {
      updates.resolvedBy = userId || null;
      updates.resolvedAt = now;
    }

    const result = await db
      .update(notifications)
      .set(updates)
      .where(inArray(notifications.id, ids));

    return result.rowCount ?? 0;
  }

  /**
   * Mark all as read for a user
   */
  async markAllAsRead(userId?: string): Promise<number> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const conditions = [eq(notifications.status, "new")];
    if (userId) {
      conditions.push(
        or(
          eq(notifications.userId, userId),
          sql`${notifications.userId} IS NULL`
        )!
      );
    }

    const result = await db
      .update(notifications)
      .set({
        status: "seen",
        updatedAt: new Date(),
      })
      .where(and(...conditions));

    return result.rowCount ?? 0;
  }

  /**
   * Get notification statistics
   */
  async getStats(userId?: string): Promise<NotificationStats> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userCondition = userId
      ? or(eq(notifications.userId, userId), sql`${notifications.userId} IS NULL`)
      : undefined;

    // Total
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(userCondition);
    const total = totalResult[0]?.count || 0;

    // Unread
    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(userCondition ? and(userCondition, eq(notifications.status, "new")) : eq(notifications.status, "new"));
    const unread = unreadResult[0]?.count || 0;

    // By status
    const statusResults = await db
      .select({
        status: notifications.status,
        count: sql<number>`count(*)`,
      })
      .from(notifications)
      .where(userCondition)
      .groupBy(notifications.status);

    const byStatus = {} as Record<NotificationStatus, number>;
    statusResults.forEach((r: { status: string; count: number }) => {
      byStatus[r.status as NotificationStatus] = r.count;
    });

    // By severity
    const severityResults = await db
      .select({
        severity: notifications.severity,
        count: sql<number>`count(*)`,
      })
      .from(notifications)
      .where(userCondition)
      .groupBy(notifications.severity);

    const bySeverity = {} as Record<NotificationSeverity, number>;
    severityResults.forEach((r: { severity: string; count: number }) => {
      bySeverity[r.severity as NotificationSeverity] = r.count;
    });

    // By category
    const categoryResults = await db
      .select({
        category: notifications.category,
        count: sql<number>`count(*)`,
      })
      .from(notifications)
      .where(userCondition)
      .groupBy(notifications.category);

    const byCategory = {} as Record<NotificationCategory, number>;
    categoryResults.forEach((r: { category: string; count: number }) => {
      byCategory[r.category as NotificationCategory] = r.count;
    });

    // Last 24h
    const last24hResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        userCondition
          ? and(userCondition, gte(notifications.createdAt, last24h))
          : gte(notifications.createdAt, last24h)
      );
    const last24hCount = last24hResult[0]?.count || 0;

    // Last 7d
    const last7dResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        userCondition
          ? and(userCondition, gte(notifications.createdAt, last7d))
          : gte(notifications.createdAt, last7d)
      );
    const last7dCount = last7dResult[0]?.count || 0;

    return {
      total,
      unread,
      byStatus,
      bySeverity,
      byCategory,
      last24h: last24hCount,
      last7d: last7dCount,
    };
  }

  // ===================================
  // Delivery Tracking
  // ===================================

  /**
   * Record a delivery attempt
   */
  async recordDelivery(
    notificationId: string,
    result: DeliveryResult
  ): Promise<void> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    // Add to delivery log
    await db.insert(notificationDeliveryLog).values({
      notificationId,
      channel: result.channel,
      success: result.success,
      error: result.error || null,
      messageId: result.messageId || null,
      createdAt: result.timestamp,
    });

    // Update notification's deliveredVia
    const notification = await this.getById(notificationId);
    if (notification && result.success) {
      const deliveredVia = [...notification.deliveredVia];
      if (!deliveredVia.includes(result.channel)) {
        deliveredVia.push(result.channel);
        await db
          .update(notifications)
          .set({
            deliveredVia: JSON.stringify(deliveredVia),
            updatedAt: new Date(),
          })
          .where(eq(notifications.id, notificationId));
      }
    }
  }

  // ===================================
  // Rules Management
  // ===================================

  /**
   * Get all notification rules
   */
  async getRules(): Promise<NotificationRule[]> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select()
      .from(notificationRules)
      .orderBy(desc(notificationRules.priority));

    return results.map(recordToRule);
  }

  /**
   * Get enabled rules
   */
  async getEnabledRules(): Promise<NotificationRule[]> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.enabled, true))
      .orderBy(desc(notificationRules.priority));

    return results.map(recordToRule);
  }

  // ===================================
  // Preferences Management
  // ===================================

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (results.length === 0) return null;
    return recordToPreferences(results[0]);
  }

  /**
   * Get or create default preferences
   */
  async getOrCreatePreferences(userId: string): Promise<NotificationPreferences> {
    const existing = await this.getPreferences(userId);
    if (existing) return existing;

    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    const defaultPrefs = {
      userId,
      emailEnabled: true,
      slackEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      categoryPreferences: null,
      quietHours: null,
      emailDigest: null,
      createdAt: now,
      updatedAt: now,
    };

    const [insertedPreferences] = await db
      .insert(notificationPreferences)
      .values(defaultPrefs)
      .returning();

    return recordToPreferences({
      ...insertedPreferences,
      id: requireUuid(insertedPreferences?.id, "notification_preferences"),
    } as NotificationPreferencesRecord);
  }

  // ===================================
  // Real-time Pub/Sub
  // ===================================

  /**
   * Subscribe to notification updates
   */
  subscribe(callback: Subscriber): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  /**
   * Publish notification to subscribers
   */
  private publish(notification: Notification): void {
    subscribers.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error("Error in notification subscriber:", error);
      }
    });
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return subscribers.size;
  }

  // ===================================
  // Cleanup
  // ===================================

  /**
   * Delete old notifications
   */
  async deleteOlderThan(days: number): Promise<number> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Only delete resolved/acknowledged notifications
    const result = await db
      .delete(notifications)
      .where(
        and(
          lte(notifications.createdAt, cutoff),
          or(
            eq(notifications.status, "resolved"),
            eq(notifications.status, "acknowledged")
          )
        )
      );

    return result.rowCount ?? 0;
  }
}

// Singleton instance
export const notificationService = new NotificationService();

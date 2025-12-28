/**
 * Webhooks Repository
 * 
 * Database operations for webhook events and alerts
 */

import { eq, desc, and, sql, gte, isNull } from "drizzle-orm";
import { getPostgresDb } from "../postgres";
import {
  webhookEvents,
  alerts,
} from "../../schema-pg";

export class WebhooksRepository {
  // ==========================================
  // Webhook Events
  // ==========================================

  /**
   * Store incoming webhook event
   */
  async storeWebhookEvent(data: {
    source: string;
    eventType: string;
    applicationId?: string;
    payload: Record<string, unknown>;
    signature?: string;
  }): Promise<string> {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(webhookEvents)
      .values({
        source: data.source,
        eventType: data.eventType,
        applicationId: data.applicationId,
        payload: data.payload,
        signature: data.signature,
        processed: false,
      })
      .returning({ id: webhookEvents.id });

    return results[0].id;
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(id: string, error?: string): Promise<void> {
    const db = await getPostgresDb();
    if (!db) return;

    await db
      .update(webhookEvents)
      .set({
        processed: !error,
        processedAt: new Date(),
        error,
      })
      .where(eq(webhookEvents.id, id));
  }

  /**
   * Get unprocessed webhook events
   */
  async getUnprocessed(limit: number = 100) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.processed, false))
      .orderBy(webhookEvents.createdAt)
      .limit(limit);
  }

  /**
   * Get webhook events by source
   */
  async getBySource(source: string, options?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    applicationId?: string;
  }) {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.source, source));

    if (options?.eventType) {
      query = query.where(
        and(
          eq(webhookEvents.source, source),
          eq(webhookEvents.eventType, options.eventType)
        )
      );
    }

    if (options?.applicationId) {
      query = query.where(
        and(
          eq(webhookEvents.source, source),
          eq(webhookEvents.applicationId, options.applicationId)
        )
      );
    }

    query = query.orderBy(desc(webhookEvents.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  /**
   * Get recent webhook events
   */
  async getRecent(limit: number = 50) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit);
  }

  /**
   * Get webhook event by ID
   */
  async getWebhookById(id: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Clean up old processed webhook events
   */
  async cleanupOldEvents(daysToKeep: number = 30): Promise<number> {
    const db = await getPostgresDb();
    if (!db) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await db
      .delete(webhookEvents)
      .where(
        and(
          eq(webhookEvents.processed, true),
          sql`${webhookEvents.createdAt} < ${cutoff}`
        )
      )
      .returning({ id: webhookEvents.id });

    return result.length;
  }

  // ==========================================
  // Alerts
  // ==========================================

  /**
   * Create alert
   */
  async createAlert(data: {
    applicationId?: string;
    name: string;
    severity: string;
    status: string;
    summary: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    startsAt?: Date;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(alerts)
      .values({
        applicationId: data.applicationId,
        name: data.name,
        severity: data.severity,
        status: data.status || "firing",
        summary: data.summary,
        description: data.description,
        labels: data.labels || {},
        annotations: data.annotations || {},
        startsAt: data.startsAt || new Date(),
      })
      .returning();

    return results[0];
  }

  /**
   * Get alerts by application
   */
  async getAlerts(applicationId?: string, options?: {
    limit?: number;
    status?: string;
    severity?: string;
    activeOnly?: boolean;
  }) {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db.select().from(alerts);

    if (applicationId) {
      query = query.where(eq(alerts.applicationId, applicationId));
    }

    if (options?.status) {
      if (applicationId) {
        query = query.where(
          and(
            eq(alerts.applicationId, applicationId),
            eq(alerts.status, options.status)
          )
        );
      } else {
        query = query.where(eq(alerts.status, options.status));
      }
    }

    if (options?.severity) {
      query = query.where(eq(alerts.severity, options.severity));
    }

    if (options?.activeOnly) {
      query = query.where(isNull(alerts.endsAt));
    }

    query = query.orderBy(desc(alerts.startsAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  /**
   * Get alert by ID
   */
  async getAlertById(id: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(
    id: string,
    status: string,
    resolvedAt?: Date
  ) {
    const db = await getPostgresDb();
    if (!db) return null;

    const updateData: Record<string, unknown> = { status };
    if (status === "resolved" && resolvedAt) {
      updateData.endsAt = resolvedAt;
    }

    const results = await db
      .update(alerts)
      .set(updateData)
      .where(eq(alerts.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(id: string, acknowledgedBy: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(alerts)
      .set({
        status: "acknowledged",
        acknowledgedBy,
        acknowledgedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(id: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(alerts)
      .set({
        status: "resolved",
        endsAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Get firing alerts count
   */
  async getFiringAlertsCount(applicationId?: string) {
    const db = await getPostgresDb();
    if (!db) return { total: 0, critical: 0, warning: 0, info: 0 };

    let baseCondition = eq(alerts.status, "firing");

    if (applicationId) {
      baseCondition = and(
        eq(alerts.applicationId, applicationId),
        eq(alerts.status, "firing")
      ) as typeof baseCondition;
    }

    const results = await db
      .select({
        severity: alerts.severity,
        count: sql<number>`count(*)`,
      })
      .from(alerts)
      .where(baseCondition)
      .groupBy(alerts.severity);

    const counts = { total: 0, critical: 0, warning: 0, info: 0 };
    for (const row of results) {
      const count = Number(row.count);
      counts.total += count;
      if (row.severity === "critical") counts.critical = count;
      if (row.severity === "warning") counts.warning = count;
      if (row.severity === "info") counts.info = count;
    }

    return counts;
  }

  /**
   * Get alerts stats over time
   */
  async getAlertsStats(applicationId?: string, days: number = 30) {
    const db = await getPostgresDb();
    if (!db) return [];

    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = db
      .select({
        date: sql<string>`date(${alerts.startsAt})`,
        count: sql<number>`count(*)`,
        severity: alerts.severity,
      })
      .from(alerts)
      .where(gte(alerts.startsAt, since));

    if (applicationId) {
      query = query.where(
        and(
          eq(alerts.applicationId, applicationId),
          gte(alerts.startsAt, since)
        )
      );
    }

    const results = await query
      .groupBy(sql`date(${alerts.startsAt})`, alerts.severity)
      .orderBy(sql`date(${alerts.startsAt})`);

    return results.map((r: { date: string; count: number; severity: string }) => ({
      date: r.date,
      count: Number(r.count),
      severity: r.severity,
    }));
  }
}

// Export singleton instance
export const webhooksRepo = new WebhooksRepository();

/**
 * Activity Service
 * 
 * Core service for managing activity events - CRUD operations,
 * querying, and real-time event publishing.
 */

import { getDbAsync } from "@/lib/db";
import { activityEvents, NewActivityEvent, ActivityEvent as ActivityEventRecord } from "@repo/db";
import { desc, eq, and, or, gte, lte, like, sql, inArray } from "drizzle-orm";
import { 
  ActivityEvent, 
  CreateActivityEvent, 
  ActivityFilter, 
  ActivityQueryResult,
  ActivityStats,
  ActivitySource,
  ActivityCategory,
  ActivitySeverity,
} from "./types";

// In-memory pub/sub for real-time updates
type Subscriber = (event: ActivityEvent) => void;
const subscribers = new Set<Subscriber>();

/**
 * Generate a unique ID for activity events
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `act_${timestamp}_${random}`;
}

/**
 * Convert database record to ActivityEvent
 */
function recordToEvent(record: ActivityEventRecord): ActivityEvent {
  return {
    id: record.id,
    timestamp: record.timestamp, // Already a Date in PostgreSQL
    source: record.source as ActivitySource,
    category: record.category as ActivityCategory,
    eventType: record.eventType,
    severity: record.severity as ActivitySeverity,
    appId: record.appId || undefined,
    appName: record.appName || undefined,
    environment: record.environment || undefined,
    title: record.title,
    description: record.description || undefined,
    actor: record.actorType ? {
      type: record.actorType as 'user' | 'system' | 'webhook' | 'automation',
      id: record.actorId || undefined,
      name: record.actorName || undefined,
      email: record.actorEmail || undefined,
      avatar: record.actorAvatar || undefined,
    } : undefined,
    links: record.links ? JSON.parse(record.links) : undefined,
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
  };
}

/**
 * Convert CreateActivityEvent to database record
 */
function eventToRecord(event: CreateActivityEvent): NewActivityEvent {
  const now = new Date();
  return {
    timestamp: now,
    source: event.source,
    category: event.category,
    eventType: event.eventType,
    severity: event.severity,
    appId: event.appId || null,
    appName: event.appName || null,
    environment: event.environment || null,
    title: event.title,
    description: event.description || null,
    actorType: event.actor?.type || null,
    actorId: event.actor?.id || null,
    actorName: event.actor?.name || null,
    actorEmail: event.actor?.email || null,
    actorAvatar: event.actor?.avatar || null,
    links: event.links ? JSON.stringify(event.links) : null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    createdAt: now,
  };
}

export class ActivityService {
  /**
   * Create a new activity event
   */
  async create(event: CreateActivityEvent): Promise<ActivityEvent> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const record = eventToRecord(event);
    
    await db.insert(activityEvents).values(record);
    
    const activityEvent = recordToEvent(record as ActivityEventRecord);
    
    // Publish to subscribers for real-time updates
    this.publish(activityEvent);
    
    return activityEvent;
  }

  /**
   * Create multiple activity events in a batch
   */
  async createMany(events: CreateActivityEvent[]): Promise<ActivityEvent[]> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const records = events.map(eventToRecord);
    
    await db.insert(activityEvents).values(records);
    
    const activityEvents_ = records.map((r: NewActivityEvent) => recordToEvent(r as ActivityEventRecord));
    
    // Publish each event
    activityEvents_.forEach((event: ActivityEvent) => this.publish(event));
    
    return activityEvents_;
  }

  /**
   * Get a single activity event by ID
   */
  async getById(id: string): Promise<ActivityEvent | null> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const results = await db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.id, id))
      .limit(1);
    
    if (results.length === 0) return null;
    
    return recordToEvent(results[0]);
  }

  /**
   * Query activity events with filters
   */
  async query(filter: ActivityFilter = {}): Promise<ActivityQueryResult> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const {
      sources,
      categories,
      severities,
      appIds,
      environments,
      startDate,
      endDate,
      search,
      limit = 50,
      offset = 0,
    } = filter;

    // Build conditions
    const conditions = [];

    if (sources && sources.length > 0) {
      conditions.push(inArray(activityEvents.source, sources));
    }

    if (categories && categories.length > 0) {
      conditions.push(inArray(activityEvents.category, categories));
    }

    if (severities && severities.length > 0) {
      conditions.push(inArray(activityEvents.severity, severities));
    }

    if (appIds && appIds.length > 0) {
      conditions.push(inArray(activityEvents.appId, appIds));
    }

    if (environments && environments.length > 0) {
      conditions.push(inArray(activityEvents.environment, environments));
    }

    if (startDate) {
      conditions.push(gte(activityEvents.timestamp, startDate));
    }

    if (endDate) {
      conditions.push(lte(activityEvents.timestamp, endDate));
    }

    if (search) {
      conditions.push(
        or(
          like(activityEvents.title, `%${search}%`),
          like(activityEvents.description, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityEvents)
      .where(whereClause);
    
    const total = countResult[0]?.count || 0;

    // Get events
    const results = await db
      .select()
      .from(activityEvents)
      .where(whereClause)
      .orderBy(desc(activityEvents.timestamp))
      .limit(limit)
      .offset(offset);

    const events = results.map(recordToEvent);
    const hasMore = offset + events.length < total;

    return {
      events,
      total,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
    };
  }

  /**
   * Get recent activity events
   */
  async getRecent(limit: number = 20): Promise<ActivityEvent[]> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const results = await db
      .select()
      .from(activityEvents)
      .orderBy(desc(activityEvents.timestamp))
      .limit(limit);

    return results.map(recordToEvent);
  }

  /**
   * Get activity events for a specific app
   */
  async getByApp(appId: string, limit: number = 50): Promise<ActivityEvent[]> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const results = await db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.appId, appId))
      .orderBy(desc(activityEvents.timestamp))
      .limit(limit);

    return results.map(recordToEvent);
  }

  /**
   * Get activity statistics
   */
  async getStats(): Promise<ActivityStats> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityEvents);
    const total = totalResult[0]?.count || 0;

    // Last 24h count
    const last24hResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityEvents)
      .where(gte(activityEvents.timestamp, last24h));
    const last24hCount = last24hResult[0]?.count || 0;

    // Last 7d count
    const last7dResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityEvents)
      .where(gte(activityEvents.timestamp, last7d));
    const last7dCount = last7dResult[0]?.count || 0;

    // By category
    const categoryResults = await db
      .select({
        category: activityEvents.category,
        count: sql<number>`count(*)`,
      })
      .from(activityEvents)
      .groupBy(activityEvents.category);

    const byCategory = {} as Record<ActivityCategory, number>;
    categoryResults.forEach((r: { category: string; count: number }) => {
      byCategory[r.category as ActivityCategory] = r.count;
    });

    // By severity
    const severityResults = await db
      .select({
        severity: activityEvents.severity,
        count: sql<number>`count(*)`,
      })
      .from(activityEvents)
      .groupBy(activityEvents.severity);

    const bySeverity = {} as Record<ActivitySeverity, number>;
    severityResults.forEach((r: { severity: string; count: number }) => {
      bySeverity[r.severity as ActivitySeverity] = r.count;
    });

    // By source
    const sourceResults = await db
      .select({
        source: activityEvents.source,
        count: sql<number>`count(*)`,
      })
      .from(activityEvents)
      .groupBy(activityEvents.source);

    const bySource = {} as Record<ActivitySource, number>;
    sourceResults.forEach((r: { source: string; count: number }) => {
      bySource[r.source as ActivitySource] = r.count;
    });

    return {
      total,
      last24h: last24hCount,
      last7d: last7dCount,
      byCategory,
      bySeverity,
      bySource,
    };
  }

  /**
   * Delete old activity events (cleanup)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const db = await getDbAsync();
    if (!db) throw new Error("Database not available");
    
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(activityEvents)
      .where(lte(activityEvents.timestamp, cutoff));
    
    return result.rowCount ?? 0;
  }

  // ===================================
  // Real-time Pub/Sub Methods
  // ===================================

  /**
   * Subscribe to activity events
   */
  subscribe(callback: Subscriber): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  /**
   * Publish an event to all subscribers
   */
  private publish(event: ActivityEvent): void {
    subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in activity subscriber:", error);
      }
    });
  }

  /**
   * Get the number of active subscribers
   */
  getSubscriberCount(): number {
    return subscribers.size;
  }
}

// Singleton instance
export const activityService = new ActivityService();

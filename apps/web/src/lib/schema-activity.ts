/**
 * Activity Events Database Schema
 * 
 * Stores all activity events for the real-time activity feed
 */

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(), // ISO string
  
  // Source identification
  source: text("source").notNull(), // gitea, clerk, stripe, sentry, etc.
  
  // Event classification
  category: text("category").notNull(), // deployment, auth, payment, error, etc.
  eventType: text("event_type").notNull(), // e.g., "deployment.completed"
  severity: text("severity").notNull().default("info"), // info, warning, error, critical
  
  // Context
  appId: text("app_id"),
  appName: text("app_name"),
  environment: text("environment"),
  
  // Content
  title: text("title").notNull(),
  description: text("description"),
  
  // Actor (who/what triggered this)
  actorType: text("actor_type"), // user, system, webhook, automation
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  actorAvatar: text("actor_avatar"),
  
  // Links (JSON array)
  links: text("links"), // JSON string
  
  // Raw data for drilling down
  metadata: text("metadata"), // JSON string
  
  // Timestamps
  createdAt: text("created_at").notNull(),
}, (table) => ({
  timestampIdx: index("idx_activity_timestamp").on(table.timestamp),
  sourceIdx: index("idx_activity_source").on(table.source),
  categoryIdx: index("idx_activity_category").on(table.category),
  appIdIdx: index("idx_activity_app_id").on(table.appId),
  severityIdx: index("idx_activity_severity").on(table.severity),
}));

// Type for inserting new activity events
export type NewActivityEvent = typeof activityEvents.$inferInsert;

// Type for selecting activity events
export type ActivityEventRecord = typeof activityEvents.$inferSelect;

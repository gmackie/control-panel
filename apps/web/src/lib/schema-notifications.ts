/**
 * Notifications Database Schema
 * 
 * Tables for notifications, rules, preferences, and push subscriptions
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ===================================
// Notifications Table
// ===================================

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  
  // Source tracking
  source: text("source").notNull(),
  sourceEventId: text("source_event_id"),
  activityEventId: text("activity_event_id"),
  
  // Classification
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  
  // Content
  title: text("title").notNull(),
  message: text("message").notNull(),
  
  // Context
  appId: text("app_id"),
  appName: text("app_name"),
  environment: text("environment"),
  
  // Actions and links (JSON)
  actions: text("actions"),
  links: text("links"),
  
  // Status
  status: text("status").notNull().default("new"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: text("acknowledged_at"),
  resolvedBy: text("resolved_by"),
  resolvedAt: text("resolved_at"),
  snoozedUntil: text("snoozed_until"),
  
  // Grouping
  groupKey: text("group_key"),
  groupCount: integer("group_count").default(1),
  
  // Delivery tracking (JSON array)
  deliveredVia: text("delivered_via"),
  
  // User targeting
  userId: text("user_id"),
  
  // Extra data (JSON)
  metadata: text("metadata"),
}, (table) => ({
  createdAtIdx: index("idx_notifications_created_at").on(table.createdAt),
  statusIdx: index("idx_notifications_status").on(table.status),
  severityIdx: index("idx_notifications_severity").on(table.severity),
  categoryIdx: index("idx_notifications_category").on(table.category),
  userIdIdx: index("idx_notifications_user_id").on(table.userId),
  appIdIdx: index("idx_notifications_app_id").on(table.appId),
  groupKeyIdx: index("idx_notifications_group_key").on(table.groupKey),
  sourceEventIdIdx: index("idx_notifications_source_event_id").on(table.sourceEventId),
}));

// ===================================
// Notification Rules Table
// ===================================

export const notificationRules = sqliteTable("notification_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: integer("enabled").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  
  // Matching conditions (JSON)
  conditions: text("conditions").notNull(),
  
  // Delivery channels (JSON array)
  channels: text("channels").notNull(),
  
  // Deduplication settings (JSON)
  dedupe: text("dedupe"),
  
  // Schedule settings (JSON)
  schedule: text("schedule"),
  
  // Metadata
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
}, (table) => ({
  enabledIdx: index("idx_notification_rules_enabled").on(table.enabled),
  priorityIdx: index("idx_notification_rules_priority").on(table.priority),
}));

// ===================================
// Notification Preferences Table
// ===================================

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  
  // Global toggles
  emailEnabled: integer("email_enabled").notNull().default(1),
  slackEnabled: integer("slack_enabled").notNull().default(1),
  pushEnabled: integer("push_enabled").notNull().default(1),
  inAppEnabled: integer("in_app_enabled").notNull().default(1),
  
  // Per-category settings (JSON)
  categoryPreferences: text("category_preferences"),
  
  // Quiet hours (JSON)
  quietHours: text("quiet_hours"),
  
  // Email digest settings (JSON)
  emailDigest: text("email_digest"),
  
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  userIdIdx: index("idx_notification_preferences_user_id").on(table.userId),
}));

// ===================================
// Push Subscriptions Table
// ===================================

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  
  // Device info
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),
  platform: text("platform").notNull(), // ios, android, web
  
  // Push token
  pushToken: text("push_token").notNull(),
  
  // Status
  active: integer("active").notNull().default(1),
  lastUsedAt: text("last_used_at"),
  
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  userIdIdx: index("idx_push_subscriptions_user_id").on(table.userId),
  deviceIdIdx: index("idx_push_subscriptions_device_id").on(table.deviceId),
  activeIdx: index("idx_push_subscriptions_active").on(table.active),
}));

// ===================================
// Notification Delivery Log Table
// ===================================

export const notificationDeliveryLog = sqliteTable("notification_delivery_log", {
  id: text("id").primaryKey(),
  notificationId: text("notification_id").notNull(),
  
  channel: text("channel").notNull(),
  success: integer("success").notNull(),
  error: text("error"),
  messageId: text("message_id"),
  
  createdAt: text("created_at").notNull(),
}, (table) => ({
  notificationIdIdx: index("idx_delivery_log_notification_id").on(table.notificationId),
  channelIdx: index("idx_delivery_log_channel").on(table.channel),
}));

// Type exports
export type NotificationRecord = typeof notifications.$inferSelect;
export type NewNotificationRecord = typeof notifications.$inferInsert;

export type NotificationRuleRecord = typeof notificationRules.$inferSelect;
export type NewNotificationRuleRecord = typeof notificationRules.$inferInsert;

export type NotificationPreferencesRecord = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferencesRecord = typeof notificationPreferences.$inferInsert;

export type PushSubscriptionRecord = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRecord = typeof pushSubscriptions.$inferInsert;

export type DeliveryLogRecord = typeof notificationDeliveryLog.$inferSelect;
export type NewDeliveryLogRecord = typeof notificationDeliveryLog.$inferInsert;

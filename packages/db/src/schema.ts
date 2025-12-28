/**
 * Database Schema
 * 
 * Drizzle ORM schema definitions for Turso/SQLite
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ===================================
// Applications
// ===================================

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  repositoryUrl: text("repository_url"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ===================================
// Activity Events
// ===================================

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  source: text("source").notNull(),
  category: text("category").notNull(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull(),
  appId: text("app_id"),
  appName: text("app_name"),
  environment: text("environment"),
  title: text("title").notNull(),
  description: text("description"),
  actorType: text("actor_type"),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  actorAvatar: text("actor_avatar"),
  links: text("links"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});

// ===================================
// Notifications
// ===================================

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  source: text("source").notNull(),
  sourceEventId: text("source_event_id"),
  activityEventId: text("activity_event_id"),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  appId: text("app_id"),
  appName: text("app_name"),
  environment: text("environment"),
  actions: text("actions"),
  links: text("links"),
  status: text("status").notNull().default("new"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: text("acknowledged_at"),
  resolvedBy: text("resolved_by"),
  resolvedAt: text("resolved_at"),
  snoozedUntil: text("snoozed_until"),
  groupKey: text("group_key"),
  groupCount: integer("group_count").default(1),
  deliveredVia: text("delivered_via"),
  userId: text("user_id"),
  metadata: text("metadata"),
});

export const notificationRules = sqliteTable("notification_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: integer("enabled").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  conditions: text("conditions").notNull(),
  channels: text("channels").notNull(),
  dedupe: text("dedupe"),
  schedule: text("schedule"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
});

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  emailEnabled: integer("email_enabled").notNull().default(1),
  slackEnabled: integer("slack_enabled").notNull().default(1),
  pushEnabled: integer("push_enabled").notNull().default(1),
  inAppEnabled: integer("in_app_enabled").notNull().default(1),
  categoryPreferences: text("category_preferences"),
  quietHours: text("quiet_hours"),
  emailDigest: text("email_digest"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),
  platform: text("platform").notNull(),
  pushToken: text("push_token").notNull(),
  active: integer("active").notNull().default(1),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const notificationDeliveryLog = sqliteTable("notification_delivery_log", {
  id: text("id").primaryKey(),
  notificationId: text("notification_id").notNull(),
  channel: text("channel").notNull(),
  success: integer("success").notNull(),
  error: text("error"),
  messageId: text("message_id"),
  createdAt: text("created_at").notNull(),
});

// ===================================
// Users (for internal tracking)
// ===================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatar: text("avatar"),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ===================================
// Type Exports
// ===================================

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;

export type NotificationRecord = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type NotificationRule = typeof notificationRules.$inferSelect;
export type NewNotificationRule = typeof notificationRules.$inferInsert;

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ===================================
// Cost Tracking
// ===================================

/**
 * Cost entries - individual cost records from various providers
 * This is the main table for tracking all infrastructure and service costs
 */
export const costEntries = sqliteTable("cost_entries", {
  id: text("id").primaryKey(),
  
  // Provider information
  provider: text("provider").notNull(), // hetzner, aws, gcp, azure, stripe, turso, openrouter, etc.
  service: text("service").notNull(), // specific service name (e.g., "EC2", "Lambda", "VPS")
  
  // Resource identification
  resourceId: text("resource_id").notNull(), // external resource ID
  resourceName: text("resource_name").notNull(),
  resourceType: text("resource_type").notNull(), // server, database, storage, api, etc.
  
  // Application attribution (critical for per-app cost tracking)
  applicationId: text("application_id"), // links to applications table
  applicationName: text("application_name"),
  environment: text("environment"), // production, staging, development
  namespace: text("namespace"), // k8s namespace if applicable
  
  // Cost data
  amount: real("amount").notNull(), // cost amount
  currency: text("currency").notNull().default("USD"),
  period: text("period").notNull(), // hourly, daily, monthly
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  
  // Usage metrics
  usageQuantity: real("usage_quantity"),
  usageUnit: text("usage_unit"), // hours, GB, requests, tokens, etc.
  
  // Categorization
  category: text("category").notNull(), // compute, storage, network, database, api, monitoring, other
  
  // Metadata
  tags: text("tags"), // JSON array of tags
  metadata: text("metadata"), // JSON object for additional data
  
  // Timestamps
  collectedAt: text("collected_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  providerIdx: index("cost_entries_provider_idx").on(table.provider),
  applicationIdx: index("cost_entries_application_idx").on(table.applicationId),
  periodStartIdx: index("cost_entries_period_start_idx").on(table.periodStart),
  categoryIdx: index("cost_entries_category_idx").on(table.category),
}));

/**
 * Cost aggregations - pre-computed daily/monthly summaries for fast queries
 */
export const costAggregations = sqliteTable("cost_aggregations", {
  id: text("id").primaryKey(),
  
  // Aggregation dimensions
  aggregationType: text("aggregation_type").notNull(), // daily, monthly
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  
  // Grouping dimensions (any can be null for totals)
  provider: text("provider"),
  applicationId: text("application_id"),
  applicationName: text("application_name"),
  environment: text("environment"),
  category: text("category"),
  
  // Aggregated values
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  entryCount: integer("entry_count").notNull(),
  
  // Breakdown (JSON for flexibility)
  byResourceType: text("by_resource_type"), // JSON: { "server": 100, "storage": 50 }
  byService: text("by_service"), // JSON: { "EC2": 80, "S3": 20 }
  
  // Comparison data
  previousPeriodAmount: real("previous_period_amount"),
  changePercent: real("change_percent"),
  
  // Timestamps
  calculatedAt: text("calculated_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  typeIdx: index("cost_agg_type_idx").on(table.aggregationType),
  periodIdx: index("cost_agg_period_idx").on(table.periodStart),
  appIdx: index("cost_agg_app_idx").on(table.applicationId),
}));

/**
 * Budgets - spending limits and alerts
 */
export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Scope
  applicationId: text("application_id"), // null = all apps
  environment: text("environment"), // null = all environments
  provider: text("provider"), // null = all providers
  category: text("category"), // null = all categories
  
  // Budget configuration
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  period: text("period").notNull(), // monthly, quarterly, yearly
  
  // Current spend tracking
  currentSpend: real("current_spend").notNull().default(0),
  lastCalculatedAt: text("last_calculated_at"),
  
  // Alerts
  alertThresholds: text("alert_thresholds"), // JSON: [{ percent: 80, notified: false }, ...]
  alertChannels: text("alert_channels"), // JSON: ["email", "slack"]
  
  // Status
  enabled: integer("enabled").notNull().default(1),
  
  // Timestamps
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Cost alerts - triggered budget/anomaly alerts
 */
export const costAlerts = sqliteTable("cost_alerts", {
  id: text("id").primaryKey(),
  
  // Alert type
  alertType: text("alert_type").notNull(), // budget_threshold, anomaly, spike, forecast
  severity: text("severity").notNull(), // warning, critical
  
  // Reference
  budgetId: text("budget_id"), // for budget alerts
  applicationId: text("application_id"),
  provider: text("provider"),
  
  // Alert details
  title: text("title").notNull(),
  message: text("message").notNull(),
  thresholdPercent: real("threshold_percent"),
  currentAmount: real("current_amount"),
  budgetAmount: real("budget_amount"),
  
  // Status
  status: text("status").notNull().default("active"), // active, acknowledged, resolved
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: text("acknowledged_at"),
  resolvedAt: text("resolved_at"),
  
  // Notifications
  notifiedVia: text("notified_via"), // JSON array of channels notified
  
  // Timestamps
  triggeredAt: text("triggered_at").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * Third-party integration costs - API usage costs from external services
 */
export const integrationCosts = sqliteTable("integration_costs", {
  id: text("id").primaryKey(),
  
  // Integration identification
  integrationId: text("integration_id").notNull(),
  integrationType: text("integration_type").notNull(), // stripe, openrouter, elevenlabs, turso, etc.
  applicationId: text("application_id"),
  applicationName: text("application_name"),
  
  // Period
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  
  // Usage metrics
  usageType: text("usage_type").notNull(), // api_calls, tokens, messages, storage, transactions
  usageQuantity: real("usage_quantity").notNull(),
  usageUnit: text("usage_unit").notNull(),
  
  // Cost
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  
  // Additional details
  breakdown: text("breakdown"), // JSON for detailed breakdown
  metadata: text("metadata"),
  
  // Timestamps
  collectedAt: text("collected_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  integrationIdx: index("int_costs_integration_idx").on(table.integrationType),
  appIdx: index("int_costs_app_idx").on(table.applicationId),
  periodIdx: index("int_costs_period_idx").on(table.periodStart),
}));

// ===================================
// Cost Tracking Type Exports
// ===================================

export type CostEntry = typeof costEntries.$inferSelect;
export type NewCostEntry = typeof costEntries.$inferInsert;

export type CostAggregation = typeof costAggregations.$inferSelect;
export type NewCostAggregation = typeof costAggregations.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type CostAlert = typeof costAlerts.$inferSelect;
export type NewCostAlert = typeof costAlerts.$inferInsert;

export type IntegrationCost = typeof integrationCosts.$inferSelect;
export type NewIntegrationCost = typeof integrationCosts.$inferInsert;

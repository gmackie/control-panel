/**
 * Database Schema
 * 
 * Drizzle ORM schema definitions for Neon/PostgreSQL
 */

import { pgTable, text, integer, real, timestamp, boolean, index, uuid, varchar } from "drizzle-orm/pg-core";

// ===================================
// Applications
// ===================================

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  repositoryUrl: text("repository_url"),
  repositoryPath: text("repository_path"),
  localRepoPath: text("local_repo_path"), // Local filesystem path for LLM agent to read secrets
  appType: varchar("app_type", { length: 50 }).notNull().default("web"),
  platform: varchar("platform", { length: 50 }),
  productId: uuid("product_id"),
  k8sNamespace: varchar("k8s_namespace", { length: 255 }),
  k8sDeploymentName: varchar("k8s_deployment_name", { length: 255 }),
  vercelProjectId: text("vercel_project_id"),
  expoProjectId: text("expo_project_id"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  productIdIdx: index("applications_product_id_idx").on(table.productId),
  appTypeIdx: index("applications_app_type_idx").on(table.appType),
}));

// ===================================
// Activity Events
// ===================================

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  source: varchar("source", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 50 }).notNull(),
  appId: uuid("app_id"),
  appName: text("app_name"),
  environment: varchar("environment", { length: 50 }),
  title: text("title").notNull(),
  description: text("description"),
  actorType: varchar("actor_type", { length: 50 }),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  actorAvatar: text("actor_avatar"),
  links: text("links"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("activity_events_app_id_idx").on(table.appId),
  timestampIdx: index("activity_events_timestamp_idx").on(table.timestamp),
  sourceIdx: index("activity_events_source_idx").on(table.source),
}));

// ===================================
// Notifications
// ===================================

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  source: varchar("source", { length: 100 }).notNull(),
  sourceEventId: text("source_event_id"),
  activityEventId: uuid("activity_event_id"),
  category: varchar("category", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 50 }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  appId: uuid("app_id"),
  appName: text("app_name"),
  environment: varchar("environment", { length: 50 }),
  actions: text("actions"),
  links: text("links"),
  status: varchar("status", { length: 50 }).notNull().default("new"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  snoozedUntil: timestamp("snoozed_until"),
  groupKey: text("group_key"),
  groupCount: integer("group_count").default(1),
  deliveredVia: text("delivered_via"),
  userId: text("user_id"),
  metadata: text("metadata"),
}, (table) => ({
  appIdIdx: index("notifications_app_id_idx").on(table.appId),
  userIdIdx: index("notifications_user_id_idx").on(table.userId),
  statusIdx: index("notifications_status_idx").on(table.status),
  createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
}));

export const notificationRules = pgTable("notification_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  conditions: text("conditions").notNull(), // JSON
  channels: text("channels").notNull(), // JSON
  dedupe: text("dedupe"), // JSON
  schedule: text("schedule"), // JSON
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: text("created_by"),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  slackEnabled: boolean("slack_enabled").notNull().default(true),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  categoryPreferences: text("category_preferences"), // JSON
  quietHours: text("quiet_hours"), // JSON
  emailDigest: text("email_digest"), // JSON
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),
  platform: varchar("platform", { length: 50 }).notNull(),
  pushToken: text("push_token").notNull(),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  pushTokenIdx: index("push_subscriptions_push_token_idx").on(table.pushToken),
}));

export const notificationDeliveryLog = pgTable("notification_delivery_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id").notNull(),
  channel: varchar("channel", { length: 50 }).notNull(),
  success: boolean("success").notNull(),
  error: text("error"),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  notificationIdIdx: index("notification_delivery_log_notification_id_idx").on(table.notificationId),
}));

// ===================================
// Users (for internal tracking)
// ===================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatar: text("avatar"),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===================================
// API Keys
// ===================================

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  
  keyHash: text("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  
  permissions: text("permissions").notNull().default("[]"),
  
  lastUsedAt: timestamp("last_used_at"),
  lastUsedIp: text("last_used_ip"),
  usageCount: integer("usage_count").notNull().default(0),
  
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("api_keys_user_id_idx").on(table.userId),
  keyPrefixIdx: index("api_keys_key_prefix_idx").on(table.keyPrefix),
  keyHashIdx: index("api_keys_key_hash_idx").on(table.keyHash),
}));

// ===================================
// Alerts
// ===================================

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  severity: varchar("severity", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  summary: text("summary").notNull(),
  description: text("description"),
  labels: text("labels"),
}, (table) => ({
  nameIdx: index("alerts_name_idx").on(table.name),
  statusIdx: index("alerts_status_idx").on(table.status),
  startsAtIdx: index("alerts_starts_at_idx").on(table.startsAt),
}));

// ===================================
// Services
// ===================================

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("unknown"),
  uptime: varchar("uptime", { length: 20 }).default("0%"),
  version: varchar("version", { length: 50 }).default("1.0.0"),
  environment: varchar("environment", { length: 50 }).default("development"),
  url: text("url"),
  lastChecked: timestamp("last_checked").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceMetrics = pgTable("service_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  cpu: real("cpu"),
  memory: real("memory"),
  requests: integer("requests"),
  responseTime: real("response_time"),
  errorRate: real("error_rate"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const serviceIntegrations = pgTable("service_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  type: varchar("type", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  name: text("name").notNull(),
  config: text("config").notNull(), // JSON
  status: varchar("status", { length: 50 }).notNull().default("active"),
  lastChecked: timestamp("last_checked").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===================================
// Deployments
// ===================================

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  namespace: varchar("namespace", { length: 255 }).notNull(),
  repository: text("repository").notNull(),
  branch: varchar("branch", { length: 255 }).notNull(),
  commit: varchar("commit", { length: 255 }).notNull(),
  commitMessage: text("commit_message").notNull(),
  author: text("author").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: varchar("status", { length: 50 }).notNull(),
  environment: varchar("environment", { length: 50 }).notNull(),
  url: text("url"),
});

export const deploymentHistory = pgTable("deployment_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentId: uuid("deployment_id").notNull(),
  applicationId: text("application_id").notNull(),
  applicationName: text("application_name").notNull(),
  environment: varchar("environment", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  version: varchar("version", { length: 100 }),
  commitSha: varchar("commit_sha", { length: 255 }),
  commitMessage: text("commit_message"),
  branch: varchar("branch", { length: 255 }),
  image: text("image"),
  replicas: integer("replicas"),
  status: varchar("status", { length: 50 }).notNull(),
  triggeredBy: text("triggered_by").notNull(),
  details: text("details"),
  metadata: text("metadata"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  applicationIdIdx: index("deployment_history_application_id_idx").on(table.applicationId),
  environmentIdx: index("deployment_history_environment_idx").on(table.environment),
  startedAtIdx: index("deployment_history_started_at_idx").on(table.startedAt),
}));

// ===================================
// Databases
// ===================================

export const databases = pgTable("databases", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  appId: uuid("app_id").notNull(),
  location: varchar("location", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  connections: integer("connections").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("databases_app_id_idx").on(table.appId),
}));

export const databaseOperations = pgTable("database_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  databaseId: uuid("database_id").notNull().references(() => databases.id),
  reads: integer("reads").notNull().default(0),
  writes: integer("writes").notNull().default(0),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// ===================================
// Customers & Revenue
// ===================================

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerSubscriptions = pgTable("customer_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  plan: varchar("plan", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  mrr: real("mrr").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerUsage = pgTable("customer_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  apiCalls: integer("api_calls").notNull().default(0),
  dataProcessed: integer("data_processed").notNull().default(0),
  activeUsers: integer("active_users").notNull().default(0),
  period: varchar("period", { length: 50 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const revenueMetrics = pgTable("revenue_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  mrr: real("mrr").notNull(),
  arr: real("arr").notNull(),
  newCustomers: integer("new_customers").notNull().default(0),
  churnedCustomers: integer("churned_customers").notNull().default(0),
  revenue: text("revenue").notNull(), // JSON
  topPlans: text("top_plans").notNull(), // JSON
  period: varchar("period", { length: 50 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// ===================================
// Usage Analytics
// ===================================

export const usageAnalytics = pgTable("usage_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id").notNull(),
  period: varchar("period", { length: 50 }).notNull(),
  requests: integer("requests").notNull(),
  uniqueUsers: integer("unique_users").notNull(),
  avgResponseTime: real("avg_response_time").notNull(),
  errorRate: real("error_rate").notNull(),
  p95ResponseTime: real("p95_response_time").notNull(),
  p99ResponseTime: real("p99_response_time").notNull(),
  topEndpoints: text("top_endpoints").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("usage_analytics_app_id_idx").on(table.appId),
  timestampIdx: index("usage_analytics_timestamp_idx").on(table.timestamp),
}));

// ===================================
// Cost Tracking
// ===================================

/**
 * Cost entries - individual cost records from various providers
 * This is the main table for tracking all infrastructure and service costs
 */
export const costEntries = pgTable("cost_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Provider information
  provider: varchar("provider", { length: 100 }).notNull(), // hetzner, aws, gcp, azure, stripe, turso, openrouter, etc.
  service: varchar("service", { length: 100 }).notNull(), // specific service name (e.g., "EC2", "Lambda", "VPS")
  
  // Resource identification
  resourceId: text("resource_id").notNull(), // external resource ID
  resourceName: text("resource_name").notNull(),
  resourceType: varchar("resource_type", { length: 100 }).notNull(), // server, database, storage, api, etc.
  
  // Application attribution (critical for per-app cost tracking)
  applicationId: uuid("application_id"), // links to applications table
  applicationName: text("application_name"),
  environment: varchar("environment", { length: 50 }), // production, staging, development
  namespace: varchar("namespace", { length: 255 }), // k8s namespace if applicable
  
  // Cost data
  amount: real("amount").notNull(), // cost amount
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  period: varchar("period", { length: 50 }).notNull(), // hourly, daily, monthly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Usage metrics
  usageQuantity: real("usage_quantity"),
  usageUnit: varchar("usage_unit", { length: 50 }), // hours, GB, requests, tokens, etc.
  
  // Categorization
  category: varchar("category", { length: 100 }).notNull(), // compute, storage, network, database, api, monitoring, other
  
  // Metadata
  tags: text("tags"), // JSON array of tags
  metadata: text("metadata"), // JSON object for additional data
  
  // Timestamps
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  providerIdx: index("cost_entries_provider_idx").on(table.provider),
  applicationIdx: index("cost_entries_application_idx").on(table.applicationId),
  periodStartIdx: index("cost_entries_period_start_idx").on(table.periodStart),
  categoryIdx: index("cost_entries_category_idx").on(table.category),
}));

/**
 * Cost aggregations - pre-computed daily/monthly summaries for fast queries
 */
export const costAggregations = pgTable("cost_aggregations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Aggregation dimensions
  aggregationType: varchar("aggregation_type", { length: 50 }).notNull(), // daily, monthly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Grouping dimensions (any can be null for totals)
  provider: varchar("provider", { length: 100 }),
  applicationId: uuid("application_id"),
  applicationName: text("application_name"),
  environment: varchar("environment", { length: 50 }),
  category: varchar("category", { length: 100 }),
  
  // Aggregated values
  totalAmount: real("total_amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  entryCount: integer("entry_count").notNull(),
  
  // Breakdown (JSON for flexibility)
  byResourceType: text("by_resource_type"), // JSON: { "server": 100, "storage": 50 }
  byService: text("by_service"), // JSON: { "EC2": 80, "S3": 20 }
  
  // Comparison data
  previousPeriodAmount: real("previous_period_amount"),
  changePercent: real("change_percent"),
  
  // Timestamps
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  typeIdx: index("cost_agg_type_idx").on(table.aggregationType),
  periodIdx: index("cost_agg_period_idx").on(table.periodStart),
  appIdx: index("cost_agg_app_idx").on(table.applicationId),
}));

/**
 * Budgets - spending limits and alerts
 */
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Scope
  applicationId: uuid("application_id"), // null = all apps
  environment: varchar("environment", { length: 50 }), // null = all environments
  provider: varchar("provider", { length: 100 }), // null = all providers
  category: varchar("category", { length: 100 }), // null = all categories
  
  // Budget configuration
  amount: real("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  period: varchar("period", { length: 50 }).notNull(), // monthly, quarterly, yearly
  
  // Current spend tracking
  currentSpend: real("current_spend").notNull().default(0),
  lastCalculatedAt: timestamp("last_calculated_at"),
  
  // Alerts
  alertThresholds: text("alert_thresholds"), // JSON: [{ percent: 80, notified: false }, ...]
  alertChannels: text("alert_channels"), // JSON: ["email", "slack"]
  
  // Status
  enabled: boolean("enabled").notNull().default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Cost alerts - triggered budget/anomaly alerts
 */
export const costAlerts = pgTable("cost_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Alert type
  alertType: varchar("alert_type", { length: 50 }).notNull(), // budget_threshold, anomaly, spike, forecast
  severity: varchar("severity", { length: 50 }).notNull(), // warning, critical
  
  // Reference
  budgetId: uuid("budget_id"), // for budget alerts
  applicationId: uuid("application_id"),
  provider: varchar("provider", { length: 100 }),
  
  // Alert details
  title: text("title").notNull(),
  message: text("message").notNull(),
  thresholdPercent: real("threshold_percent"),
  currentAmount: real("current_amount"),
  budgetAmount: real("budget_amount"),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, acknowledged, resolved
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  
  // Notifications
  notifiedVia: text("notified_via"), // JSON array of channels notified
  
  // Timestamps
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Third-party integration costs - API usage costs from external services
 */
export const integrationCosts = pgTable("integration_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Integration identification
  integrationId: text("integration_id").notNull(),
  integrationType: varchar("integration_type", { length: 100 }).notNull(), // stripe, openrouter, elevenlabs, turso, etc.
  applicationId: uuid("application_id"),
  applicationName: text("application_name"),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Usage metrics
  usageType: varchar("usage_type", { length: 100 }).notNull(), // api_calls, tokens, messages, storage, transactions
  usageQuantity: real("usage_quantity").notNull(),
  usageUnit: varchar("usage_unit", { length: 50 }).notNull(),
  
  // Cost
  amount: real("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  
  // Additional details
  breakdown: text("breakdown"), // JSON for detailed breakdown
  metadata: text("metadata"),
  
  // Timestamps
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  integrationIdx: index("int_costs_integration_idx").on(table.integrationType),
  appIdx: index("int_costs_app_idx").on(table.applicationId),
  periodIdx: index("int_costs_period_idx").on(table.periodStart),
}));

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

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;

export type DeploymentHistoryRecord = typeof deploymentHistory.$inferSelect;
export type NewDeploymentHistory = typeof deploymentHistory.$inferInsert;

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

// ===================================
// AI Dev Sessions (Bob Integration)
// ===================================

/**
 * AI Development Sessions - tracks AI-assisted bug fixing sessions
 * Links Sentry/PostHog issues to Bob AI agent worktrees
 */
export const aiDevSessions = pgTable("ai_dev_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Issue source information
  issueSource: varchar("issue_source", { length: 50 }).notNull(), // sentry, posthog, manual
  issueId: text("issue_id").notNull(), // external issue ID
  issueTitle: text("issue_title").notNull(),
  issueUrl: text("issue_url"),
  issueSeverity: varchar("issue_severity", { length: 50 }), // fatal, error, warning
  
  // Application context
  applicationId: uuid("application_id"),
  applicationName: text("application_name"),
  repositoryUrl: text("repository_url").notNull(),
  branch: varchar("branch", { length: 255 }).notNull().default("main"),
  
  // Bob worktree information
  worktreeId: text("worktree_id"), // Bob's worktree ID
  worktreePath: text("worktree_path"),
  
  // AI agent configuration
  agentType: varchar("agent_type", { length: 50 }).notNull().default("claude"), // claude, kiro, codex, opencode, cursor
  agentInstanceId: text("agent_instance_id"), // Bob's instance ID
  
  // Session state
  status: varchar("status", { length: 50 }).notNull().default("pending"), 
  // pending, cloning, analyzing, fixing, testing, review, approved, merged, failed, cancelled
  
  // Analysis results
  analysisResult: text("analysis_result"), // JSON: AI's analysis of the issue
  proposedFix: text("proposed_fix"), // JSON: Proposed changes
  filesChanged: text("files_changed"), // JSON: Array of file paths
  
  // PR information (after fix is applied)
  prNumber: integer("pr_number"),
  prUrl: text("pr_url"),
  prTitle: text("pr_title"),
  prStatus: varchar("pr_status", { length: 50 }), // open, merged, closed
  
  // Approval workflow
  requiresApproval: boolean("requires_approval").notNull().default(true),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Metrics
  tokensUsed: integer("tokens_used"),
  costEstimate: real("cost_estimate"),
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  
  // User who initiated
  createdBy: text("created_by"),
  
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  issueSourceIdx: index("ai_dev_sessions_issue_source_idx").on(table.issueSource),
  issueIdIdx: index("ai_dev_sessions_issue_id_idx").on(table.issueId),
  applicationIdx: index("ai_dev_sessions_application_idx").on(table.applicationId),
  statusIdx: index("ai_dev_sessions_status_idx").on(table.status),
  createdAtIdx: index("ai_dev_sessions_created_at_idx").on(table.createdAt),
}));

/**
 * AI Dev Session Logs - detailed activity log for each session
 */
export const aiDevSessionLogs = pgTable("ai_dev_session_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => aiDevSessions.id, { onDelete: "cascade" }),
  
  // Log entry details
  level: varchar("level", { length: 20 }).notNull(), // info, warn, error, debug
  phase: varchar("phase", { length: 50 }).notNull(), // cloning, analyzing, fixing, testing, pr_creation, etc.
  message: text("message").notNull(),
  details: text("details"), // JSON: Additional context
  
  // Progress tracking
  progress: integer("progress"), // 0-100 percent
  
  // Timestamps
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  sessionIdIdx: index("ai_dev_session_logs_session_id_idx").on(table.sessionId),
  timestampIdx: index("ai_dev_session_logs_timestamp_idx").on(table.timestamp),
}));

/**
 * AI Dev Session Comments - user comments and AI responses during review
 */
export const aiDevSessionComments = pgTable("ai_dev_session_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => aiDevSessions.id, { onDelete: "cascade" }),
  
  // Comment details
  authorType: varchar("author_type", { length: 20 }).notNull(), // user, ai
  authorId: text("author_id"),
  authorName: text("author_name"),
  
  content: text("content").notNull(),
  
  // If referencing specific code
  filePath: text("file_path"),
  lineNumber: integer("line_number"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdIdx: index("ai_dev_session_comments_session_id_idx").on(table.sessionId),
}));

export type AiDevSession = typeof aiDevSessions.$inferSelect;
export type NewAiDevSession = typeof aiDevSessions.$inferInsert;

export type AiDevSessionLog = typeof aiDevSessionLogs.$inferSelect;
export type NewAiDevSessionLog = typeof aiDevSessionLogs.$inferInsert;

export type AiDevSessionComment = typeof aiDevSessionComments.$inferSelect;
export type NewAiDevSessionComment = typeof aiDevSessionComments.$inferInsert;

// ===================================
// Notion Integration
// ===================================

/**
 * Notion configuration per application
 * Links a Notion database to an application for task syncing
 */
export const notionConfigs = pgTable("notion_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Application link
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  // Notion database info
  notionDatabaseId: text("notion_database_id").notNull(),
  notionDatabaseName: text("notion_database_name").notNull(),
  notionDatabaseUrl: text("notion_database_url"),
  
  // Sync configuration
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  syncFrequencyMinutes: integer("sync_frequency_minutes").notNull().default(15),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }), // success, failed, partial
  lastSyncError: text("last_sync_error"),
  
  // Property mappings (how Notion properties map to our task model)
  // JSON: { "statusProperty": "Status", "priorityProperty": "Priority", ... }
  propertyMappings: text("property_mappings"),
  
  // Webhook configuration
  webhookEnabled: boolean("webhook_enabled").notNull().default(false),
  webhookSecret: text("webhook_secret"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  applicationIdIdx: index("notion_configs_application_id_idx").on(table.applicationId),
  notionDatabaseIdIdx: index("notion_configs_notion_database_id_idx").on(table.notionDatabaseId),
}));

/**
 * Notion task links - correlates Notion tasks with AI sessions and git branches
 * This is the main table for tracking Notion tasks and their development lifecycle
 */
export const notionTaskLinks = pgTable("notion_task_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Notion page identification
  notionPageId: text("notion_page_id").notNull(),
  notionDatabaseId: text("notion_database_id").notNull(),
  
  // Application context
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  
  // Task data (cached from Notion)
  title: text("title").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("not_started"), // not_started, in_progress, done, blocked, cancelled
  priority: varchar("priority", { length: 50 }), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  assignee: text("assignee"),
  tags: text("tags"), // JSON array
  notionUrl: text("notion_url").notNull(),
  
  // AI session correlation (links to Bob AI sessions)
  aiSessionId: uuid("ai_session_id").references(() => aiDevSessions.id, { onDelete: "set null" }),
  
  // Git/PR correlation
  gitBranch: varchar("git_branch", { length: 255 }),
  prNumber: integer("pr_number"),
  prUrl: text("pr_url"),
  prStatus: varchar("pr_status", { length: 50 }), // open, merged, closed
  
  // Sync metadata
  lastSyncAt: timestamp("last_sync_at").notNull().defaultNow(),
  notionCreatedAt: timestamp("notion_created_at"),
  notionUpdatedAt: timestamp("notion_updated_at"),
  
  // Raw Notion properties for reference
  rawProperties: text("raw_properties"), // JSON
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  notionPageIdIdx: index("notion_task_links_page_id_idx").on(table.notionPageId),
  notionDatabaseIdIdx: index("notion_task_links_database_id_idx").on(table.notionDatabaseId),
  applicationIdIdx: index("notion_task_links_application_id_idx").on(table.applicationId),
  aiSessionIdIdx: index("notion_task_links_ai_session_id_idx").on(table.aiSessionId),
  statusIdx: index("notion_task_links_status_idx").on(table.status),
}));

/**
 * Notion sync logs - tracks sync history for debugging and monitoring
 */
export const notionSyncLogs = pgTable("notion_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Config reference
  configId: uuid("config_id").notNull().references(() => notionConfigs.id, { onDelete: "cascade" }),
  
  // Sync details
  syncType: varchar("sync_type", { length: 50 }).notNull(), // full, incremental, webhook
  status: varchar("status", { length: 50 }).notNull(), // started, success, failed, partial
  
  // Metrics
  tasksCreated: integer("tasks_created").notNull().default(0),
  tasksUpdated: integer("tasks_updated").notNull().default(0),
  tasksDeleted: integer("tasks_deleted").notNull().default(0),
  
  // Error details
  errorMessage: text("error_message"),
  errorDetails: text("error_details"), // JSON
  
  // Timing
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
}, (table) => ({
  configIdIdx: index("notion_sync_logs_config_id_idx").on(table.configId),
  startedAtIdx: index("notion_sync_logs_started_at_idx").on(table.startedAt),
}));

export type NotionConfig = typeof notionConfigs.$inferSelect;
export type NewNotionConfig = typeof notionConfigs.$inferInsert;

export type NotionTaskLink = typeof notionTaskLinks.$inferSelect;
export type NewNotionTaskLink = typeof notionTaskLinks.$inferInsert;

export type NotionSyncLog = typeof notionSyncLogs.$inferSelect;
export type NewNotionSyncLog = typeof notionSyncLogs.$inferInsert;

// ===================================
// Unified Task Management
// ===================================

/**
 * Task sync configurations - per-application provider setup
 * Configurable during application setup
 */
export const taskSyncConfigs = pgTable("task_sync_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Application link
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  // Provider configuration
  provider: varchar("provider", { length: 50 }).notNull(), // github, gitea, task, notion
  enabled: boolean("enabled").notNull().default(false),
  
  // Provider-specific config
  // GitHub/Gitea: { owner, repo }
  // Task: { workspaceId, projectId? }
  // Notion: { databaseId }
  config: text("config"), // JSON
  
  // Sync settings
  syncDirection: varchar("sync_direction", { length: 20 }).notNull().default("bidirectional"), // bidirectional, push_only, pull_only
  autoSync: boolean("auto_sync").notNull().default(true),
  syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(15),
  
  // Sync status
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }), // success, failed, partial
  lastSyncError: text("last_sync_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  applicationIdIdx: index("task_sync_configs_application_id_idx").on(table.applicationId),
  providerIdx: index("task_sync_configs_provider_idx").on(table.provider),
  uniqueAppProvider: index("task_sync_configs_unique_app_provider").on(table.applicationId, table.provider),
}));

/**
 * Unified tasks - source of truth for all tasks/issues
 * Syncs bidirectionally with GitHub Issues, Gitea Issues, Linear Issues, Notion Tasks
 */
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Application context
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  // Task content
  title: text("title").notNull(),
  description: text("description"), // Markdown
  
  // Status and workflow
  status: varchar("status", { length: 50 }).notNull().default("backlog"), 
  // backlog, todo, in_progress, in_review, done, cancelled
  priority: varchar("priority", { length: 20 }), // urgent, high, medium, low
  
  // Assignment and organization
  assignee: text("assignee"), // User identifier
  labels: text("labels"), // JSON array of label strings
  
  // Planning
  dueDate: timestamp("due_date"),
  estimate: varchar("estimate", { length: 20 }), // Story points or time estimate
  
  // Release linkage
  releaseId: uuid("release_id"), // Links task to a release
  
  // External provider links (for sync tracking)
  // JSON: { id, number, url, provider }
  githubLink: text("github_link"), // { owner, repo, number, url, nodeId }
  giteaLink: text("gitea_link"), // { owner, repo, number, url }
  taskLink: text("task_link"), // { id, identifier, url }
  notionLink: text("notion_link"), // { pageId, url }
  
  // Sync metadata
  syncStatus: varchar("sync_status", { length: 50 }).notNull().default("local_only"),
  // local_only, synced, pending_push, conflict, externally_deleted
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  
  // Source tracking (where was this task originally created)
  sourceProvider: varchar("source_provider", { length: 50 }), // control_panel, github, gitea, task, notion
  sourceId: text("source_id"), // External ID if created externally
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
}, (table) => ({
  applicationIdIdx: index("tasks_application_id_idx").on(table.applicationId),
  statusIdx: index("tasks_status_idx").on(table.status),
  releaseIdIdx: index("tasks_release_id_idx").on(table.releaseId),
  assigneeIdx: index("tasks_assignee_idx").on(table.assignee),
  createdAtIdx: index("tasks_created_at_idx").on(table.createdAt),
}));

/**
 * Task comments - unified comments synced across providers
 */
export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  
  // Comment content
  body: text("body").notNull(), // Markdown
  
  // Author
  authorId: text("author_id"),
  authorName: text("author_name"),
  authorAvatar: text("author_avatar"),
  
  // External sync
  githubCommentId: text("github_comment_id"),
  giteaCommentId: text("gitea_comment_id"),
  taskCommentId: text("task_comment_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  taskIdIdx: index("task_comments_task_id_idx").on(table.taskId),
}));

/**
 * Task activity log - tracks all changes for audit/sync
 */
export const taskActivityLog = pgTable("task_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  
  // Activity details
  action: varchar("action", { length: 50 }).notNull(), // created, updated, status_changed, assigned, commented, linked, synced
  field: varchar("field", { length: 50 }), // Which field changed
  oldValue: text("old_value"),
  newValue: text("new_value"),
  
  // Actor
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  actorType: varchar("actor_type", { length: 20 }), // user, system, sync
  
  // Source of change
  source: varchar("source", { length: 50 }).notNull(), // control_panel, github, gitea, task, notion
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  taskIdIdx: index("task_activity_log_task_id_idx").on(table.taskId),
  createdAtIdx: index("task_activity_log_created_at_idx").on(table.createdAt),
}));

// ===================================
// Release Management
// ===================================

/**
 * Releases - version/release tracking with semantic versioning
 * Can publish to GitHub Releases and Gitea Releases
 */
export const releases = pgTable("releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Application context
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  // Version info (semantic versioning)
  version: varchar("version", { length: 50 }).notNull(), // e.g., "1.2.3"
  name: text("name"), // Optional release name (e.g., "Phoenix")
  
  // Release content
  description: text("description"), // Short description
  changelog: text("changelog"), // Full changelog in Markdown
  
  // Release status
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  // draft, ready, published, deployed
  
  // Git info
  targetBranch: varchar("target_branch", { length: 255 }).default("main"),
  commitSha: varchar("commit_sha", { length: 255 }),
  tagName: varchar("tag_name", { length: 100 }), // e.g., "v1.2.3"
  
  // Publishing status per provider
  // JSON: { published: boolean, releaseId, url, publishedAt }
  githubRelease: text("github_release"),
  giteaRelease: text("gitea_release"),
  
  // Deployment tracking
  deployedEnvironments: text("deployed_environments"), // JSON array: ["staging", "production"]
  
  // Metadata
  isPrerelease: boolean("is_prerelease").notNull().default(false),
  
  // Author
  createdBy: text("created_by"),
  publishedBy: text("published_by"),
  
  // Timestamps
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  applicationIdIdx: index("releases_application_id_idx").on(table.applicationId),
  versionIdx: index("releases_version_idx").on(table.version),
  statusIdx: index("releases_status_idx").on(table.status),
  createdAtIdx: index("releases_created_at_idx").on(table.createdAt),
  uniqueAppVersion: index("releases_unique_app_version").on(table.applicationId, table.version),
}));

/**
 * Release assets - files attached to releases
 */
export const releaseAssets = pgTable("release_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  
  // Asset info
  name: text("name").notNull(),
  contentType: varchar("content_type", { length: 100 }),
  size: integer("size"), // bytes
  
  // URLs
  downloadUrl: text("download_url"),
  githubAssetId: text("github_asset_id"),
  giteaAssetId: text("gitea_asset_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  releaseIdIdx: index("release_assets_release_id_idx").on(table.releaseId),
}));

// ===================================
// Task & Release Type Exports
// ===================================

export type TaskSyncConfig = typeof taskSyncConfigs.$inferSelect;
export type NewTaskSyncConfig = typeof taskSyncConfigs.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TaskComment = typeof taskComments.$inferSelect;
export type NewTaskComment = typeof taskComments.$inferInsert;

export type TaskActivityLogEntry = typeof taskActivityLog.$inferSelect;
export type NewTaskActivityLogEntry = typeof taskActivityLog.$inferInsert;

export type Release = typeof releases.$inferSelect;
export type NewRelease = typeof releases.$inferInsert;

export type ReleaseAsset = typeof releaseAssets.$inferSelect;
export type NewReleaseAsset = typeof releaseAssets.$inferInsert;

// ===================================
// Products (Groups of Applications)
// ===================================

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("products_slug_idx").on(table.slug),
}));

// ===================================
// Organization-wide Integrations
// ===================================

export const orgIntegrations = pgTable("org_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 100 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  config: text("config"),
  credentials: text("credentials"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  providerIdx: index("org_integrations_provider_idx").on(table.provider),
}));

// ===================================
// Product-level Integrations
// ===================================

export const productIntegrations = pgTable("product_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 100 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  config: text("config"),
  credentials: text("credentials"),
  orgIntegrationId: uuid("org_integration_id").references(() => orgIntegrations.id),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  productIdIdx: index("product_integrations_product_id_idx").on(table.productId),
  providerIdx: index("product_integrations_provider_idx").on(table.provider),
}));

// ===================================
// Application-level Integrations
// ===================================

export const appIntegrations = pgTable("app_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 100 }).notNull(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: text("config"),
  credentials: text("credentials"),
  productIntegrationId: uuid("product_integration_id").references(() => productIntegrations.id),
  orgIntegrationId: uuid("org_integration_id").references(() => orgIntegrations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  applicationIdIdx: index("app_integrations_application_id_idx").on(table.applicationId),
  providerIdx: index("app_integrations_provider_idx").on(table.provider),
}));

// ===================================
// Vercel Projects (org-wide tracking)
// ===================================

export const vercelProjects = pgTable("vercel_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  vercelProjectId: text("vercel_project_id").notNull().unique(),
  name: text("name").notNull(),
  framework: varchar("framework", { length: 50 }),
  productionUrl: text("production_url"),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  orgIntegrationId: uuid("org_integration_id").references(() => orgIntegrations.id),
  lastDeploymentAt: timestamp("last_deployment_at"),
  lastDeploymentStatus: varchar("last_deployment_status", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vercelProjectIdIdx: index("vercel_projects_vercel_project_id_idx").on(table.vercelProjectId),
  applicationIdIdx: index("vercel_projects_application_id_idx").on(table.applicationId),
}));

// ===================================
// Expo Projects (org-wide tracking)
// ===================================

export const expoProjects = pgTable("expo_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  expoProjectId: text("expo_project_id").notNull().unique(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }),
  platform: varchar("platform", { length: 50 }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  orgIntegrationId: uuid("org_integration_id").references(() => orgIntegrations.id),
  lastBuildAt: timestamp("last_build_at"),
  lastBuildStatus: varchar("last_build_status", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  expoProjectIdIdx: index("expo_projects_expo_project_id_idx").on(table.expoProjectId),
  applicationIdIdx: index("expo_projects_application_id_idx").on(table.applicationId),
}));

// ===================================
// Neon Projects (org-wide tracking)
// ===================================

export const neonProjects = pgTable("neon_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  neonProjectId: text("neon_project_id").notNull().unique(),
  name: text("name").notNull(),
  regionId: varchar("region_id", { length: 50 }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  orgIntegrationId: uuid("org_integration_id").references(() => orgIntegrations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  neonProjectIdIdx: index("neon_projects_neon_project_id_idx").on(table.neonProjectId),
  applicationIdIdx: index("neon_projects_application_id_idx").on(table.applicationId),
}));

// ===================================
// Turso Databases (org-wide tracking)
// ===================================

export const tursoDatabases = pgTable("turso_databases", {
  id: uuid("id").primaryKey().defaultRandom(),
  tursoDbId: text("turso_db_id").notNull().unique(),
  name: text("name").notNull(),
  group: varchar("group", { length: 100 }),
  primaryRegion: varchar("primary_region", { length: 50 }),
  hostname: text("hostname"),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  orgIntegrationId: uuid("org_integration_id").references(() => orgIntegrations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tursoDbIdIdx: index("turso_databases_turso_db_id_idx").on(table.tursoDbId),
  applicationIdIdx: index("turso_databases_application_id_idx").on(table.applicationId),
}));

// ===================================
// Product Type Exports
// ===================================

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type OrgIntegration = typeof orgIntegrations.$inferSelect;
export type NewOrgIntegration = typeof orgIntegrations.$inferInsert;

export type ProductIntegration = typeof productIntegrations.$inferSelect;
export type NewProductIntegration = typeof productIntegrations.$inferInsert;

export type AppIntegration = typeof appIntegrations.$inferSelect;
export type NewAppIntegration = typeof appIntegrations.$inferInsert;

export type VercelProject = typeof vercelProjects.$inferSelect;
export type NewVercelProject = typeof vercelProjects.$inferInsert;

export type ExpoProject = typeof expoProjects.$inferSelect;
export type NewExpoProject = typeof expoProjects.$inferInsert;

export type NeonProject = typeof neonProjects.$inferSelect;
export type NewNeonProject = typeof neonProjects.$inferInsert;

export type TursoDatabase = typeof tursoDatabases.$inferSelect;
export type NewTursoDatabase = typeof tursoDatabases.$inferInsert;

// ===================================
// Integration Resources (Generic Resource Linking)
// ===================================

export const integrationResources = pgTable("integration_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  integrationId: uuid("integration_id").notNull().references(() => orgIntegrations.id, { onDelete: "cascade" }),
  
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  resourceId: text("resource_id").notNull(),
  resourceName: text("resource_name").notNull(),
  
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  
  metadata: text("metadata"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  integrationIdIdx: index("integration_resources_integration_id_idx").on(table.integrationId),
  applicationIdIdx: index("integration_resources_application_id_idx").on(table.applicationId),
  resourceTypeIdx: index("integration_resources_resource_type_idx").on(table.resourceType),
  uniqueResource: index("integration_resources_unique").on(table.integrationId, table.resourceType, table.resourceId),
}));

export type IntegrationResource = typeof integrationResources.$inferSelect;
export type NewIntegrationResource = typeof integrationResources.$inferInsert;

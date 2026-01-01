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
  status: varchar("status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from "drizzle-orm/sqlite-core";

// Services table
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("unknown"),
  uptime: text("uptime").notNull().default("0%"),
  version: text("version").notNull().default("1.0.0"),
  environment: text("environment").notNull().default("development"),
  url: text("url"),
  lastChecked: text("last_checked").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Integrations table
export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'stripe', 'turso', 'webhook', etc.
  provider: text("provider").notNull(),
  status: text("status").notNull().default("active"),
  config: text("config").notNull(), // JSON string with encrypted config
  lastChecked: text("last_checked").notNull(),
  healthStatus: text("health_status").notNull().default("unknown"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// API Keys table
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  integrationId: text("integration_id").references(() => integrations.id),
  keyHash: text("key_hash").notNull(), // Hashed API key
  permissions: text("permissions").notNull(), // JSON string
  lastUsed: text("last_used"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Integration Health Checks table
export const integrationHealthChecks = sqliteTable(
  "integration_health_checks",
  {
    id: text("id").primaryKey(),
    integrationId: text("integration_id").references(() => integrations.id),
    status: text("status").notNull(), // 'success', 'failure', 'warning'
    responseTime: integer("response_time"), // in milliseconds
    errorMessage: text("error_message"),
    timestamp: text("timestamp").notNull(),
  }
);

// Service metrics table
export const serviceMetrics = sqliteTable("service_metrics", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  cpu: real("cpu"),
  memory: real("memory"),
  requests: integer("requests"),
  responseTime: real("response_time"),
  errorRate: real("error_rate"),
  timestamp: text("timestamp").notNull(),
});

// Service integrations table
export const serviceIntegrations = sqliteTable("service_integrations", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  config: text("config").notNull(), // JSON string
  status: text("status").notNull().default("active"),
  lastChecked: text("last_checked").notNull(),
  createdAt: text("created_at").notNull(),
});

// Customers table
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Customer subscriptions table
export const customerSubscriptions = sqliteTable("customer_subscriptions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  mrr: real("mrr").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Customer usage table
export const customerUsage = sqliteTable("customer_usage", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  apiCalls: integer("api_calls").notNull().default(0),
  dataProcessed: integer("data_processed").notNull().default(0),
  activeUsers: integer("active_users").notNull().default(0),
  period: text("period").notNull(), // 'day', 'week', 'month'
  timestamp: text("timestamp").notNull(),
});

// Deployments table
export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  namespace: text("namespace").notNull(),
  repository: text("repository").notNull(),
  branch: text("branch").notNull(),
  commit: text("commit").notNull(),
  commitMessage: text("commit_message").notNull(),
  author: text("author").notNull(),
  timestamp: text("timestamp").notNull(),
  status: text("status").notNull(),
  environment: text("environment").notNull(),
  url: text("url"),
});

// Alerts table
export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  summary: text("summary").notNull(),
  description: text("description"),
  labels: text("labels"), // JSON string
});

// Database instances table
export const databases = sqliteTable("databases", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  appId: text("app_id").notNull(),
  location: text("location").notNull(),
  size: integer("size").notNull(),
  connections: integer("connections").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Database operations table
export const databaseOperations = sqliteTable("database_operations", {
  id: text("id").primaryKey(),
  databaseId: text("database_id")
    .notNull()
    .references(() => databases.id),
  reads: integer("reads").notNull().default(0),
  writes: integer("writes").notNull().default(0),
  timestamp: text("timestamp").notNull(),
});

// Revenue metrics table
export const revenueMetrics = sqliteTable("revenue_metrics", {
  id: text("id").primaryKey(),
  mrr: real("mrr").notNull(),
  arr: real("arr").notNull(),
  newCustomers: integer("new_customers").notNull().default(0),
  churnedCustomers: integer("churned_customers").notNull().default(0),
  revenue: text("revenue").notNull(), // JSON string
  topPlans: text("top_plans").notNull(), // JSON string
  period: text("period").notNull(), // 'day', 'week', 'month'
  timestamp: text("timestamp").notNull(),
});

// Usage analytics table
export const usageAnalytics = sqliteTable("usage_analytics", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull(),
  period: text("period").notNull(),
  requests: integer("requests").notNull(),
  uniqueUsers: integer("unique_users").notNull(),
  avgResponseTime: real("avg_response_time").notNull(),
  errorRate: real("error_rate").notNull(),
  p95ResponseTime: real("p95_response_time").notNull(),
  p99ResponseTime: real("p99_response_time").notNull(),
  topEndpoints: text("top_endpoints").notNull(), // JSON string
  timestamp: text("timestamp").notNull(),
});

// ===========================================
// Pipeline & Commit Tracking Tables
// ===========================================

// Commits table - tracks commits from Gitea
export const commits = sqliteTable("commits", {
  id: text("id").primaryKey(), // Use commit SHA as ID
  sha: text("sha").notNull().unique(),
  shortSha: text("short_sha").notNull(), // First 7 chars
  message: text("message").notNull(),
  author: text("author").notNull(),
  authorEmail: text("author_email"),
  authorAvatar: text("author_avatar"),
  branch: text("branch").notNull(),
  repository: text("repository").notNull(), // owner/repo format
  timestamp: text("timestamp").notNull(),
  url: text("url"), // Link to Gitea commit
  parentSha: text("parent_sha"), // For tracking commit chain
  createdAt: text("created_at").notNull(),
});

// Pipeline runs table - tracks CI/CD workflow runs
export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(),
  commitSha: text("commit_sha").notNull().references(() => commits.sha),
  repository: text("repository").notNull(),
  workflowName: text("workflow_name").notNull(),
  workflowId: integer("workflow_id"), // Gitea workflow ID
  runNumber: integer("run_number"),
  status: text("status").notNull(), // pending, running, success, failure, cancelled
  conclusion: text("conclusion"), // success, failure, cancelled, skipped, timed_out
  branch: text("branch").notNull(),
  event: text("event").notNull(), // push, pull_request, release, manual
  triggeredBy: text("triggered_by"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  duration: integer("duration"), // in seconds
  url: text("url"), // Link to Gitea workflow run
  logs: text("logs"), // JSON string of log entries
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Pipeline stages table - tracks individual stages within a pipeline
export const pipelineStages = sqliteTable("pipeline_stages", {
  id: text("id").primaryKey(),
  pipelineRunId: text("pipeline_run_id").notNull().references(() => pipelineRuns.id),
  name: text("name").notNull(),
  status: text("status").notNull(), // pending, running, success, failure, skipped
  order: integer("order").notNull(), // Stage order in pipeline
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  duration: integer("duration"), // in seconds
  logs: text("logs"), // JSON string
});

// Deployment events table - tracks deployments to environments
export const deploymentEvents = sqliteTable("deployment_events", {
  id: text("id").primaryKey(),
  commitSha: text("commit_sha").notNull(),
  pipelineRunId: text("pipeline_run_id").references(() => pipelineRuns.id),
  repository: text("repository").notNull(),
  environment: text("environment").notNull(), // staging, production
  namespace: text("namespace").notNull(), // K8s namespace
  deploymentName: text("deployment_name").notNull(), // K8s deployment name
  status: text("status").notNull(), // pending, deploying, deployed, failed, rolled_back
  imageTag: text("image_tag").notNull(),
  imageDigest: text("image_digest"),
  replicas: integer("replicas"),
  readyReplicas: integer("ready_replicas"),
  previousImageTag: text("previous_image_tag"), // For rollback tracking
  previousCommitSha: text("previous_commit_sha"),
  deployedBy: text("deployed_by"),
  deployedAt: text("deployed_at"),
  healthCheckStatus: text("health_check_status"), // healthy, unhealthy, unknown
  url: text("url"), // Application URL
  notes: text("notes"), // Deployment notes or release notes
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Release table - tracks releases/versions
export const releases = sqliteTable("releases", {
  id: text("id").primaryKey(),
  repository: text("repository").notNull(),
  tagName: text("tag_name").notNull(),
  name: text("name").notNull(),
  body: text("body"), // Release notes
  commitSha: text("commit_sha").notNull(),
  draft: integer("draft").notNull().default(0), // boolean
  prerelease: integer("prerelease").notNull().default(0), // boolean
  author: text("author").notNull(),
  url: text("url"),
  createdAt: text("created_at").notNull(),
  publishedAt: text("published_at"),
});

// Webhook events table - stores webhook events for replay/debugging
export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(), // gitea, harbor, argocd, prometheus
  eventType: text("event_type").notNull(), // push, pull_request, release, etc.
  repository: text("repository"),
  payload: text("payload").notNull(), // JSON string of full payload
  signature: text("signature"), // Webhook signature for verification
  processed: integer("processed").notNull().default(0), // boolean
  processedAt: text("processed_at"),
  error: text("error"), // Error message if processing failed
  createdAt: text("created_at").notNull(),
});

// Environment status table - tracks current state of each environment
export const environmentStatus = sqliteTable("environment_status", {
  id: text("id").primaryKey(),
  repository: text("repository").notNull(),
  environment: text("environment").notNull(), // staging, production
  namespace: text("namespace").notNull(),
  deploymentName: text("deployment_name").notNull(),
  currentCommitSha: text("current_commit_sha"),
  currentImageTag: text("current_image_tag"),
  currentVersion: text("current_version"),
  status: text("status").notNull(), // healthy, degraded, unhealthy, unknown
  replicas: integer("replicas"),
  readyReplicas: integer("ready_replicas"),
  lastDeployedAt: text("last_deployed_at"),
  lastDeployedBy: text("last_deployed_by"),
  url: text("url"),
  updatedAt: text("updated_at").notNull(),
});

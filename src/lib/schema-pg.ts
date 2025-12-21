import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===========================================
// Applications Table - Core application registry
// ===========================================
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  
  // Repository info
  repositoryUrl: text("repository_url"),
  repositoryFullName: text("repository_full_name"), // owner/repo format
  defaultBranch: text("default_branch").default("main"),
  
  // Application metadata
  language: text("language"), // TypeScript, Python, Go, etc.
  framework: text("framework"), // Next.js, FastAPI, etc.
  type: text("type").default("web"), // web, api, worker, cron
  
  // Status tracking
  status: text("status").notNull().default("unknown"), // healthy, degraded, unhealthy, unknown
  
  // Environment settings
  settings: jsonb("settings").$type<{
    environment: string;
    domain?: string;
    autoDeployEnabled: boolean;
    branchFilter?: string;
    buildCommand?: string;
    startCommand?: string;
  }>().default({
    environment: "development",
    autoDeployEnabled: true,
  }),
  
  // Integration keys (references to external services)
  giteaRepoId: integer("gitea_repo_id"),
  sentryProjectSlug: text("sentry_project_slug"),
  clerkAppId: text("clerk_app_id"),
  stripeAccountId: text("stripe_account_id"),
  posthogProjectId: text("posthog_project_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("applications_slug_idx").on(table.slug),
  nameIdx: index("applications_name_idx").on(table.name),
  statusIdx: index("applications_status_idx").on(table.status),
}));

// ===========================================
// Application Secrets - Encrypted secrets storage
// ===========================================
export const applicationSecrets = pgTable("application_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(), // SECRET_KEY, API_TOKEN, etc.
  encryptedValue: text("encrypted_value").notNull(), // AES-256-GCM encrypted
  iv: text("iv").notNull(), // Initialization vector for decryption
  
  // Metadata
  description: text("description"),
  environment: text("environment").notNull().default("all"), // production, staging, development, all
  isRotating: boolean("is_rotating").default(false),
  lastRotatedAt: timestamp("last_rotated_at"),
  expiresAt: timestamp("expires_at"),
  
  // Audit
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("secrets_app_id_idx").on(table.applicationId),
  envIdx: index("secrets_env_idx").on(table.environment),
  nameEnvIdx: uniqueIndex("secrets_name_env_idx").on(table.applicationId, table.name, table.environment),
}));

// ===========================================
// Application Integrations - Third-party service configs
// ===========================================
export const applicationIntegrations = pgTable("application_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  provider: text("provider").notNull(), // stripe, clerk, sentry, posthog, supabase, etc.
  name: text("name").notNull(), // Display name
  status: text("status").notNull().default("active"), // active, inactive, error
  
  // Encrypted configuration
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  
  // Health tracking
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").default("unknown"), // healthy, degraded, unhealthy, unknown
  healthMessage: text("health_message"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("integrations_app_id_idx").on(table.applicationId),
  providerIdx: index("integrations_provider_idx").on(table.provider),
}));

// ===========================================
// Commits Table - Git commit tracking
// ===========================================
export const commits = pgTable("commits", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  sha: text("sha").notNull(),
  shortSha: varchar("short_sha", { length: 7 }).notNull(),
  message: text("message").notNull(),
  
  // Author info
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email"),
  authorAvatar: text("author_avatar"),
  
  // Branch and repository
  branch: text("branch").notNull(),
  repository: text("repository").notNull(),
  
  // Links
  url: text("url"),
  parentSha: text("parent_sha"),
  
  // Stats
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  filesChanged: integer("files_changed").default(0),
  
  committedAt: timestamp("committed_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("commits_app_id_idx").on(table.applicationId),
  shaIdx: uniqueIndex("commits_sha_idx").on(table.sha),
  branchIdx: index("commits_branch_idx").on(table.branch),
  committedAtIdx: index("commits_committed_at_idx").on(table.committedAt),
}));

// ===========================================
// Pipeline Runs Table - CI/CD workflow execution
// ===========================================
export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  commitId: uuid("commit_id").references(() => commits.id),
  
  // Workflow info
  workflowName: text("workflow_name").notNull(),
  workflowId: integer("workflow_id"),
  runNumber: integer("run_number"),
  
  // Status
  status: text("status").notNull(), // pending, running, success, failure, cancelled
  conclusion: text("conclusion"), // success, failure, cancelled, skipped, timed_out
  
  // Trigger info
  branch: text("branch").notNull(),
  event: text("event").notNull(), // push, pull_request, release, manual
  triggeredBy: text("triggered_by"),
  
  // Timing
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  duration: integer("duration"), // in seconds
  
  // Links and logs
  url: text("url"),
  logs: jsonb("logs").$type<Array<{ timestamp: string; level: string; message: string }>>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("pipeline_runs_app_id_idx").on(table.applicationId),
  statusIdx: index("pipeline_runs_status_idx").on(table.status),
  createdAtIdx: index("pipeline_runs_created_at_idx").on(table.createdAt),
}));

// ===========================================
// Pipeline Stages Table - Individual stages within a pipeline
// ===========================================
export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineRunId: uuid("pipeline_run_id").notNull().references(() => pipelineRuns.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  status: text("status").notNull(), // pending, running, success, failure, skipped
  order: integer("order").notNull(),
  
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  duration: integer("duration"),
  
  logs: text("logs"),
  errorMessage: text("error_message"),
}, (table) => ({
  pipelineRunIdIdx: index("pipeline_stages_run_id_idx").on(table.pipelineRunId),
}));

// ===========================================
// Deployments Table - Application deployments
// ===========================================
export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  pipelineRunId: uuid("pipeline_run_id").references(() => pipelineRuns.id),
  commitId: uuid("commit_id").references(() => commits.id),
  
  // Deployment info
  environment: text("environment").notNull(), // staging, production
  namespace: text("namespace").notNull(),
  deploymentName: text("deployment_name").notNull(),
  
  // Status
  status: text("status").notNull(), // pending, deploying, deployed, failed, rolled_back
  
  // Container info
  imageTag: text("image_tag").notNull(),
  imageDigest: text("image_digest"),
  
  // Replicas
  replicas: integer("replicas").default(1),
  readyReplicas: integer("ready_replicas").default(0),
  
  // Rollback tracking
  previousImageTag: text("previous_image_tag"),
  previousCommitSha: text("previous_commit_sha"),
  
  // Metadata
  deployedBy: text("deployed_by"),
  deployedAt: timestamp("deployed_at"),
  healthCheckStatus: text("health_check_status"), // healthy, unhealthy, unknown
  url: text("url"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("deployments_app_id_idx").on(table.applicationId),
  envIdx: index("deployments_env_idx").on(table.environment),
  statusIdx: index("deployments_status_idx").on(table.status),
  createdAtIdx: index("deployments_created_at_idx").on(table.createdAt),
}));

// ===========================================
// Environment Status Table - Current state of each environment
// ===========================================
export const environmentStatus = pgTable("environment_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  environment: text("environment").notNull(),
  namespace: text("namespace").notNull(),
  deploymentName: text("deployment_name").notNull(),
  
  // Current state
  currentCommitSha: text("current_commit_sha"),
  currentImageTag: text("current_image_tag"),
  currentVersion: text("current_version"),
  
  status: text("status").notNull(), // healthy, degraded, unhealthy, unknown
  replicas: integer("replicas"),
  readyReplicas: integer("ready_replicas"),
  
  lastDeployedAt: timestamp("last_deployed_at"),
  lastDeployedBy: text("last_deployed_by"),
  url: text("url"),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdEnvIdx: uniqueIndex("env_status_app_env_idx").on(table.applicationId, table.environment),
}));

// ===========================================
// Releases Table - Version releases
// ===========================================
export const releases = pgTable("releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  tagName: text("tag_name").notNull(),
  name: text("name").notNull(),
  body: text("body"), // Release notes
  commitSha: text("commit_sha").notNull(),
  
  isDraft: boolean("is_draft").default(false),
  isPrerelease: boolean("is_prerelease").default(false),
  
  author: text("author").notNull(),
  url: text("url"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
}, (table) => ({
  appIdIdx: index("releases_app_id_idx").on(table.applicationId),
  tagIdx: uniqueIndex("releases_tag_idx").on(table.applicationId, table.tagName),
}));

// ===========================================
// Webhook Events Table - Incoming webhook events
// ===========================================
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  source: text("source").notNull(), // gitea, harbor, argocd, prometheus
  eventType: text("event_type").notNull(), // push, pull_request, release, etc.
  
  applicationId: uuid("application_id").references(() => applications.id),
  
  payload: jsonb("payload").notNull(),
  signature: text("signature"),
  
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  error: text("error"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sourceIdx: index("webhook_events_source_idx").on(table.source),
  processedIdx: index("webhook_events_processed_idx").on(table.processed),
  createdAtIdx: index("webhook_events_created_at_idx").on(table.createdAt),
}));

// ===========================================
// Activity Log Table - Application activity tracking
// ===========================================
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  
  type: text("type").notNull(), // commit, deployment, alert, config_change, etc.
  action: text("action").notNull(), // created, updated, deleted, triggered, etc.
  message: text("message").notNull(),
  
  actor: text("actor"), // Who performed the action
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("activity_log_app_id_idx").on(table.applicationId),
  typeIdx: index("activity_log_type_idx").on(table.type),
  createdAtIdx: index("activity_log_created_at_idx").on(table.createdAt),
}));

// ===========================================
// Alerts Table - Application alerts
// ===========================================
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  severity: text("severity").notNull(), // critical, warning, info
  status: text("status").notNull(), // firing, resolved, acknowledged
  
  summary: text("summary").notNull(),
  description: text("description"),
  
  labels: jsonb("labels").$type<Record<string, string>>(),
  annotations: jsonb("annotations").$type<Record<string, string>>(),
  
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("alerts_app_id_idx").on(table.applicationId),
  statusIdx: index("alerts_status_idx").on(table.status),
  severityIdx: index("alerts_severity_idx").on(table.severity),
}));

// ===========================================
// Services Table - General services registry (from original schema)
// ===========================================
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("unknown"),
  uptime: text("uptime").notNull().default("0%"),
  version: text("version").notNull().default("1.0.0"),
  environment: text("environment").notNull().default("development"),
  url: text("url"),
  lastChecked: timestamp("last_checked").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===========================================
// Service Metrics Table
// ===========================================
export const serviceMetrics = pgTable("service_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  cpu: real("cpu"),
  memory: real("memory"),
  requests: integer("requests"),
  responseTime: real("response_time"),
  errorRate: real("error_rate"),
  timestamp: timestamp("timestamp").notNull(),
}, (table) => ({
  serviceIdIdx: index("service_metrics_service_id_idx").on(table.serviceId),
  timestampIdx: index("service_metrics_timestamp_idx").on(table.timestamp),
}));

// ===========================================
// API Keys Table
// ===========================================
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(), // Hashed API key
  keyPrefix: varchar("key_prefix", { length: 8 }).notNull(), // First 8 chars for identification
  
  permissions: jsonb("permissions").$type<string[]>().default([]),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("api_keys_app_id_idx").on(table.applicationId),
  keyPrefixIdx: index("api_keys_prefix_idx").on(table.keyPrefix),
}));

// ===========================================
// Relations
// ===========================================
export const applicationsRelations = relations(applications, ({ many }) => ({
  secrets: many(applicationSecrets),
  integrations: many(applicationIntegrations),
  commits: many(commits),
  pipelineRuns: many(pipelineRuns),
  deployments: many(deployments),
  environmentStatuses: many(environmentStatus),
  releases: many(releases),
  activityLogs: many(activityLog),
  alerts: many(alerts),
  apiKeys: many(apiKeys),
}));

export const commitsRelations = relations(commits, ({ one, many }) => ({
  application: one(applications, {
    fields: [commits.applicationId],
    references: [applications.id],
  }),
  pipelineRuns: many(pipelineRuns),
  deployments: many(deployments),
}));

export const pipelineRunsRelations = relations(pipelineRuns, ({ one, many }) => ({
  application: one(applications, {
    fields: [pipelineRuns.applicationId],
    references: [applications.id],
  }),
  commit: one(commits, {
    fields: [pipelineRuns.commitId],
    references: [commits.id],
  }),
  stages: many(pipelineStages),
  deployments: many(deployments),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  application: one(applications, {
    fields: [deployments.applicationId],
    references: [applications.id],
  }),
  pipelineRun: one(pipelineRuns, {
    fields: [deployments.pipelineRunId],
    references: [pipelineRuns.id],
  }),
  commit: one(commits, {
    fields: [deployments.commitId],
    references: [commits.id],
  }),
}));

// Type exports
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationSecret = typeof applicationSecrets.$inferSelect;
export type NewApplicationSecret = typeof applicationSecrets.$inferInsert;
export type Commit = typeof commits.$inferSelect;
export type NewCommit = typeof commits.$inferInsert;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;

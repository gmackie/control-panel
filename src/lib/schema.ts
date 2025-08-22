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

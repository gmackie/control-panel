export interface AppService {
  id: string;
  name: string;
  type: "nextjs" | "go-api" | "turso" | "worker";
  status: "healthy" | "warning" | "error" | "unknown";
  uptime: string;
  version: string;
  environment: "production" | "staging" | "development";
  url?: string;
  lastChecked: string;
  metrics?: {
    cpu?: number;
    memory?: number;
    requests?: number;
    responseTime?: number;
    errorRate?: number;
  };
  integrations?: {
    stripe?: boolean;
    turso?: boolean;
  };
}

export interface Deployment {
  id: string;
  name: string;
  namespace: string;
  repository: string;
  branch: string;
  commit: string;
  commitMessage: string;
  author: string;
  timestamp: string;
  status: "running" | "pending" | "failed" | "success";
  environment: "production" | "staging" | "development";
  url?: string;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
}

export interface Alert {
  id: string;
  name: string;
  severity: "critical" | "warning" | "info";
  status: "firing" | "resolved";
  startsAt: string;
  endsAt?: string;
  summary: string;
  description?: string;
  labels?: Record<string, string>;
}

export interface Repository {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  updatedAt: string;
  defaultBranch: string;
  private: boolean;
  url: string;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface Application {
  name: string;
  namespace: string;
  environments: {
    production?: DeploymentInfo;
    staging?: DeploymentInfo;
  };
  repository?: string;
  metrics?: ApplicationMetrics;
  health: "healthy" | "degraded" | "error";
}

export interface DeploymentInfo {
  version: string;
  image: string;
  replicas: number;
  readyReplicas: number;
  commit?: string;
  deployedAt: string;
  resources?: {
    cpu: string;
    memory: string;
  };
}

export interface ApplicationMetrics {
  requestRate: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
}

export interface Secret {
  name: string;
  namespace: string;
  type: string;
  createdAt: string;
  keys: string[];
  lastRotated?: string;
  expiresAt?: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  company?: string;
  createdAt: string;
  subscription?: {
    plan: string;
    status: "active" | "canceled" | "past_due" | "trialing";
    currentPeriodEnd: string;
    mrr: number;
  };
  usage: {
    apiCalls: number;
    dataProcessed: number;
    activeUsers: number;
  };
  lifetime: {
    revenue: number;
    costs: number;
    profit: number;
  };
}

export interface TursoDatabase {
  id: string;
  name: string;
  appId: string;
  location: string;
  size: number;
  connections: number;
  operations: {
    reads: number;
    writes: number;
  };
  status: "healthy" | "warning" | "error";
}

export interface StripeMetrics {
  mrr: number;
  arr: number;
  newCustomers: number;
  churnedCustomers: number;
  revenue: {
    today: number;
    month: number;
    year: number;
  };
  topPlans: Array<{
    name: string;
    customers: number;
    revenue: number;
  }>;
}

export interface AppMetrics {
  appId: string;
  period: "hour" | "day" | "week" | "month";
  requests: number;
  uniqueUsers: number;
  avgResponseTime: number;
  errorRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  topEndpoints: Array<{
    path: string;
    count: number;
    avgTime: number;
  }>;
}

// New types for enhanced application management
export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: "web" | "api" | "worker" | "database" | "monitoring";
  framework:
    | "nextjs"
    | "react"
    | "vue"
    | "angular"
    | "go"
    | "python"
    | "nodejs"
    | "rust"
    | "custom";
  features: string[];
  defaultConfig: ServiceConfig;
  dockerfile?: string;
  dockerCompose?: string;
  k8sManifests?: string[];
  ciConfig?: string;
}

export interface ServiceConfig {
  name: string;
  namespace: string;
  replicas: number;
  resources: {
    cpu: string;
    memory: string;
    storage?: string;
  };
  environment: "development" | "staging" | "production";
  domains?: string[];
  ports: Array<{
    name: string;
    port: number;
    targetPort: number;
    protocol: "TCP" | "UDP";
  }>;
  envVars: Record<string, string>;
  secrets: string[];
  healthCheck: {
    path: string;
    initialDelaySeconds: number;
    periodSeconds: number;
    timeoutSeconds: number;
    failureThreshold: number;
  };
}

export interface Integration {
  id: string;
  serviceId: string;
  type:
    | "database"
    | "auth"
    | "payment"
    | "monitoring"
    | "ai"
    | "storage"
    | "email"
    | "sms";
  provider:
    | "turso"
    | "stripe"
    | "aws"
    | "elevenlabs"
    | "openrouter"
    | "sendgrid"
    | "twilio"
    | "custom";
  name: string;
  config: Record<string, any>;
  status: "active" | "inactive" | "error";
  lastChecked: string;
  apiKeys: string[];
  webhooks?: string[];
}

export interface Database {
  id: string;
  serviceId: string;
  name: string;
  type:
    | "turso"
    | "postgresql"
    | "mysql"
    | "mongodb"
    | "redis"
    | "elasticsearch";
  provider: "turso" | "aws" | "gcp" | "azure" | "self-hosted";
  status: "healthy" | "warning" | "error" | "creating" | "deleting";
  connectionString: string;
  size: number;
  connections: number;
  operations: {
    reads: number;
    writes: number;
  };
  migrations: DatabaseMigration[];
  backups: DatabaseBackup[];
  monitoring: DatabaseMonitoring;
}

export interface DatabaseMigration {
  id: string;
  databaseId: string;
  version: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "rolled_back";
  appliedAt?: string;
  duration?: number;
  sql: string;
  checksum: string;
}

export interface DatabaseBackup {
  id: string;
  databaseId: string;
  name: string;
  size: number;
  status: "creating" | "completed" | "failed";
  createdAt: string;
  expiresAt: string;
  location: string;
}

export interface DatabaseMonitoring {
  queries: Array<{
    sql: string;
    count: number;
    avgTime: number;
    maxTime: number;
    lastExecuted: string;
  }>;
  connections: {
    active: number;
    idle: number;
    max: number;
  };
  performance: {
    slowQueries: number;
    deadlocks: number;
    cacheHitRatio: number;
  };
}

export interface ServiceRepository {
  id: string;
  serviceId: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  provider: "gitea" | "github" | "gitlab";
  defaultBranch: string;
  private: boolean;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
  branches: string[];
  tags: string[];
  webhooks: RepositoryWebhook[];
}

export interface RepositoryWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive" | "error";
  lastTriggered?: string;
}

export interface Monitoring {
  serviceId: string;
  prometheus: {
    enabled: boolean;
    url: string;
    metrics: string[];
    alerts: Alert[];
  };
  grafana: {
    enabled: boolean;
    url: string;
    dashboards: GrafanaDashboard[];
  };
  alertmanager: {
    enabled: boolean;
    url: string;
    receivers: AlertReceiver[];
  };
  logs: {
    enabled: boolean;
    provider: "loki" | "elasticsearch" | "fluentd";
    retention: string;
    filters: LogFilter[];
  };
}

export interface GrafanaDashboard {
  id: string;
  title: string;
  uid: string;
  url: string;
  version: number;
  updatedAt: string;
  panels: DashboardPanel[];
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: "graph" | "stat" | "table" | "heatmap" | "alert";
  targets: PanelTarget[];
  options: Record<string, any>;
}

export interface PanelTarget {
  expr: string;
  legendFormat?: string;
  refId: string;
}

export interface AlertReceiver {
  id: string;
  name: string;
  type: "email" | "slack" | "webhook" | "pagerduty";
  config: Record<string, any>;
  status: "active" | "inactive";
}

export interface LogFilter {
  id: string;
  name: string;
  query: string;
  level: "debug" | "info" | "warn" | "error";
  service?: string;
  timeRange: string;
}

export interface DeploymentPipeline {
  id: string;
  serviceId: string;
  name: string;
  environments: DeploymentEnvironment[];
  stages: DeploymentStage[];
  triggers: DeploymentTrigger[];
  approvals: DeploymentApproval[];
}

export interface DeploymentEnvironment {
  id: string;
  name: string;
  cluster: string;
  namespace: string;
  domain?: string;
  config: ServiceConfig;
  status: "active" | "inactive" | "error";
}

export interface DeploymentStage {
  id: string;
  name: string;
  order: number;
  type: "build" | "test" | "deploy" | "verify" | "rollback";
  config: Record<string, any>;
  conditions: string[];
  timeout: number;
}

export interface DeploymentTrigger {
  id: string;
  type: "git-push" | "git-tag" | "manual" | "schedule" | "webhook";
  config: Record<string, any>;
  enabled: boolean;
}

export interface DeploymentApproval {
  id: string;
  stageId: string;
  type: "manual" | "automated";
  approvers: string[];
  required: boolean;
}

export interface ServiceHealth {
  serviceId: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  checks: HealthCheck[];
  lastChecked: string;
  uptime: number;
  responseTime: number;
  errorRate: number;
}

export interface HealthCheck {
  name: string;
  type: "http" | "tcp" | "command" | "database";
  status: "passing" | "failing" | "warning";
  lastCheck: string;
  responseTime?: number;
  error?: string;
}

export interface ServiceMetrics {
  serviceId: string;
  period: string;
  requests: {
    total: number;
    perSecond: number;
    byEndpoint: Array<{
      path: string;
      method: string;
      count: number;
      avgTime: number;
    }>;
  };
  errors: {
    total: number;
    rate: number;
    byType: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
  };
  resources: {
    cpu: {
      usage: number;
      limit: number;
      requests: number;
    };
    memory: {
      usage: number;
      limit: number;
      requests: number;
    };
    storage?: {
      usage: number;
      limit: number;
    };
  };
}

export interface ClerkMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: {
    today: number;
    week: number;
    month: number;
  };
  sessions: {
    active: number;
    total: number;
    avgDuration: number;
  };
  authentication: {
    signIns: number;
    signUps: number;
    failures: number;
    methods: {
      email: number;
      google: number;
      github: number;
      microsoft: number;
    };
  };
  organizations: {
    total: number;
    active: number;
    members: number;
  };
  mfa: {
    enabled: number;
    usage: number;
  };
  period: {
    start: string;
    end: string;
  };
}

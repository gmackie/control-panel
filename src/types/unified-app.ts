/**
 * Unified Application Types
 * 
 * These types represent a complete view of an application across all systems:
 * - Git repository (Gitea/GitHub)
 * - CI/CD pipelines
 * - Container registry (Harbor)
 * - Kubernetes deployments
 * - Database (Turso/Supabase)
 * - Auth (Clerk)
 * - Payments (Stripe)
 * - Analytics (PostHog)
 * - Errors (Sentry)
 */

// ==========================================
// Core Application
// ==========================================

export interface UnifiedApplication {
  id: string;
  name: string;
  slug: string;
  description?: string;
  
  // Repository info
  repository: RepositoryInfo | null;
  
  // Deployment info
  deployments: DeploymentInfo[];
  
  // Container images
  images: ContainerImage[];
  
  // Integration configurations
  integrations: IntegrationConfig[];
  
  // Current status across all systems
  status: ApplicationStatus;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  team?: string;
  tags: string[];
}

export interface ApplicationStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  repository: 'connected' | 'disconnected' | 'error';
  ci: 'passing' | 'failing' | 'pending' | 'unknown';
  staging: 'healthy' | 'degraded' | 'unhealthy' | 'deploying' | 'not_deployed';
  production: 'healthy' | 'degraded' | 'unhealthy' | 'deploying' | 'not_deployed';
  lastActivity: string;
}

// ==========================================
// Repository & Git
// ==========================================

export interface RepositoryInfo {
  provider: 'gitea' | 'github';
  owner: string;
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  
  // Latest commit
  latestCommit?: CommitInfo;
  
  // Branch info
  branches: BranchInfo[];
  
  // Open PRs
  openPullRequests: number;
  
  // Repository stats
  stars: number;
  forks: number;
  openIssues: number;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
  };
  timestamp: string;
  url: string;
  
  // Pipeline status for this commit
  pipelineStatus?: PipelineStatus;
  
  // Deployment status for this commit
  deployedTo?: string[]; // ['staging', 'production']
}

export interface BranchInfo {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  lastCommit: {
    sha: string;
    message: string;
    timestamp: string;
  };
  aheadBehind?: {
    ahead: number;
    behind: number;
  };
}

export interface PullRequestInfo {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  
  // Review status
  reviewStatus: 'pending' | 'approved' | 'changes_requested';
  reviewers: string[];
  
  // CI status
  ciStatus: 'passing' | 'failing' | 'pending' | 'unknown';
  
  // Merge info
  mergeable: boolean;
  conflicts: boolean;
}

// ==========================================
// CI/CD Pipelines
// ==========================================

export interface PipelineStatus {
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
  conclusion?: string;
  workflowName: string;
  runNumber: number;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  url: string;
  
  // Individual stages
  stages: PipelineStage[];
}

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  order: number;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  logs?: string;
}

export interface PipelineRun {
  id: string;
  commitSha: string;
  workflowName: string;
  runNumber: number;
  status: string;
  conclusion?: string;
  branch: string;
  event: string;
  triggeredBy?: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  url: string;
  stages: PipelineStage[];
}

// ==========================================
// Test Results
// ==========================================

export interface TestResults {
  lastRun: string;
  status: 'passing' | 'failing' | 'partial';
  
  // Summary
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  
  // Coverage
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  
  // Failed tests
  failedTests: TestCase[];
  
  // Duration
  duration: number;
}

export interface TestCase {
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: {
    message: string;
    stack?: string;
  };
}

// ==========================================
// Deployments & Container Images
// ==========================================

export interface DeploymentInfo {
  environment: 'staging' | 'production' | 'development' | 'preview';
  namespace: string;
  name: string;
  
  // Current state
  status: 'healthy' | 'degraded' | 'unhealthy' | 'deploying' | 'not_deployed';
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  
  // Current version
  currentCommit?: string;
  currentImage?: string;
  currentVersion?: string;
  
  // Deployment history
  lastDeployedAt?: string;
  lastDeployedBy?: string;
  
  // URLs
  url?: string;
  internalUrl?: string;
  
  // Resource usage
  resources?: {
    cpuRequests: string;
    cpuLimits: string;
    memoryRequests: string;
    memoryLimits: string;
    currentCpu: number;
    currentMemory: number;
  };
  
  // Pods
  pods: PodInfo[];
}

export interface PodInfo {
  name: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  ready: boolean;
  restarts: number;
  age: string;
  node: string;
  ip: string;
}

export interface ContainerImage {
  repository: string;
  tag: string;
  digest: string;
  size: number;
  pushedAt: string;
  pushedBy?: string;
  
  // Which environments use this image
  deployedTo: string[];
  
  // Vulnerability scan
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ==========================================
// Integration Configurations
// ==========================================

export interface IntegrationConfig {
  id: string;
  type: IntegrationType;
  name: string;
  status: 'active' | 'inactive' | 'error';
  
  // Integration-specific config (encrypted)
  config: Record<string, any>;
  
  // Health
  lastHealthCheck?: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export type IntegrationType = 
  | 'database_turso'
  | 'database_supabase'
  | 'database_postgres'
  | 'auth_clerk'
  | 'payments_stripe'
  | 'analytics_posthog'
  | 'errors_sentry'
  | 'email_sendgrid'
  | 'sms_twilio'
  | 'ai_openrouter'
  | 'voice_elevenlabs'
  | 'hosting_vercel'
  | 'custom_webhook';

// ==========================================
// Database Management
// ==========================================

export interface DatabaseInfo {
  provider: 'turso' | 'supabase' | 'postgres';
  name: string;
  region?: string;
  
  // Connection info (masked)
  host: string;
  port?: number;
  
  // Status
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  
  // Metrics
  size: number;
  connections: {
    active: number;
    max: number;
  };
  
  // Schema info
  tables: TableInfo[];
  
  // Recent migrations
  migrations: MigrationInfo[];
  
  // Recent queries (for debugging)
  recentQueries?: QueryInfo[];
  
  // Backup info
  lastBackup?: string;
  backupSchedule?: string;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  sizeBytes: number;
  columns: number;
  indexes: number;
}

export interface MigrationInfo {
  id: string;
  name: string;
  status: 'pending' | 'applied' | 'failed' | 'rolled_back';
  appliedAt?: string;
  executionTime?: number;
}

export interface QueryInfo {
  query: string;
  duration: number;
  timestamp: string;
  rowsAffected?: number;
}

// ==========================================
// User/Auth Management (Clerk)
// ==========================================

export interface AuthMetrics {
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  newUsers24h: number;
  newUsers7d: number;
  
  // Session info
  activeSessions: number;
  
  // MFA adoption
  mfaEnabled: number;
  mfaAdoptionRate: number;
  
  // Auth methods breakdown
  authMethods: {
    password: number;
    google: number;
    github: number;
    other: number;
  };
  
  // Organizations (if using Clerk orgs)
  organizations: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: string;
  lastSignIn?: string;
  
  // Auth
  emailVerified: boolean;
  mfaEnabled: boolean;
  
  // Status
  banned: boolean;
  locked: boolean;
  
  // Sessions
  activeSessions: number;
}

// ==========================================
// Error Tracking (Sentry)
// ==========================================

export interface ErrorMetrics {
  totalIssues: number;
  unresolvedIssues: number;
  newIssues24h: number;
  newIssues7d: number;
  
  // By severity
  critical: number;
  error: number;
  warning: number;
  
  // Error rate
  errorRate: number;
  errorsPerMinute: number;
  
  // Affected users
  affectedUsers: number;
  
  // Top issues
  topIssues: ErrorIssue[];
}

export interface ErrorIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: 'fatal' | 'error' | 'warning' | 'info';
  status: 'unresolved' | 'resolved' | 'ignored';
  
  // Impact
  count: number;
  userCount: number;
  
  // Timeline
  firstSeen: string;
  lastSeen: string;
  
  // Metadata
  platform: string;
  project: string;
  url: string;
}

// ==========================================
// Analytics (PostHog)
// ==========================================

export interface AnalyticsMetrics {
  // Users
  uniqueUsers24h: number;
  uniqueUsers7d: number;
  uniqueUsers30d: number;
  
  // Events
  totalEvents24h: number;
  totalEvents7d: number;
  
  // Top events
  topEvents: {
    name: string;
    count: number;
  }[];
  
  // Feature flags
  activeFeatureFlags: number;
  
  // Funnels
  conversionRate?: number;
}

// ==========================================
// Payments (Stripe)
// ==========================================

export interface PaymentMetrics {
  // Revenue
  mrr: number;
  arr: number;
  revenue30d: number;
  
  // Customers
  totalCustomers: number;
  activeSubscriptions: number;
  
  // Churn
  churnRate: number;
  
  // Recent activity
  successfulPayments24h: number;
  failedPayments24h: number;
}

// ==========================================
// Activity Log
// ==========================================

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: ActivityType;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;
  details: Record<string, any>;
  
  // Related entities
  commitSha?: string;
  deploymentId?: string;
  environment?: string;
}

export type ActivityType = 
  | 'commit'
  | 'pr_opened'
  | 'pr_merged'
  | 'pr_closed'
  | 'pipeline_started'
  | 'pipeline_completed'
  | 'deployment_started'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'rollback'
  | 'config_changed'
  | 'secret_updated'
  | 'user_action';

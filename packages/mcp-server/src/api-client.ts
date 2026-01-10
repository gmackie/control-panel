import superjson from "superjson";

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

import type { SuperJSONResult } from "superjson";

interface TrpcResponse {
  result?: {
    data: SuperJSONResult;
  };
  error?: {
    message?: string;
    data?: { httpStatus?: number };
  };
}

export class ControlPanelClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async call<T>(path: string, input?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/trpc/${path}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input !== undefined ? { json: input } : { json: {} }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `API request failed: ${response.status}`,
        response.status,
        errorText
      );
    }

    const data = (await response.json()) as TrpcResponse;

    if (data.error) {
      throw new ApiError(
        data.error.message || "Unknown API error",
        data.error.data?.httpStatus || 500,
        data.error
      );
    }

    if (!data.result) {
      throw new ApiError("Invalid API response: missing result", 500);
    }

    return superjson.deserialize(data.result.data) as T;
  }

  async query<T>(procedure: string, input?: unknown): Promise<T> {
    const url = input !== undefined
      ? `${this.baseUrl}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : `${this.baseUrl}/api/trpc/${procedure}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `API request failed: ${response.status}`,
        response.status,
        errorText
      );
    }

    const data = (await response.json()) as TrpcResponse;

    if (data.error) {
      throw new ApiError(
        data.error.message || "Unknown API error",
        data.error.data?.httpStatus || 500,
        data.error
      );
    }

    if (!data.result) {
      throw new ApiError("Invalid API response: missing result", 500);
    }

    return superjson.deserialize(data.result.data) as T;
  }

  async mutate<T>(procedure: string, input?: unknown): Promise<T> {
    return this.call<T>(procedure, input);
  }

  get applications() {
    return {
      list: () => this.query<Application[]>("applications.list"),
      byId: (id: string) => this.query<Application>("applications.byId", id),
      bySlug: (slug: string) => this.query<Application>("applications.bySlug", slug),
      listWithHealth: () => this.query<ApplicationHealth[]>("applications.listWithHealth"),
      create: (input: CreateApplicationInput) => this.mutate<Application>("applications.create", input),
      update: (input: UpdateApplicationInput) => this.mutate<Application>("applications.update", input),
    };
  }

  get integrations() {
    return {
      discover: (input?: DiscoverInput) => this.query<DiscoverResult>("integrations.discover", input),
      applicationResources: (appId: string) => this.query<ApplicationResourcesResult>("integrations.applicationResources", appId),
      linkResources: (input: LinkResourcesInput) => this.mutate<LinkResourcesResult>("integrations.linkResources", input),
      applicationSecrets: (appId: string) => this.query<ApplicationSecretsResult>("integrations.applicationSecrets", appId),
      exportEnv: (input: ExportEnvInput) => this.query<ExportEnvResult>("integrations.exportEnv", input),
      listOrgIntegrations: () => this.query<OrgIntegrationSummary[]>("integrations.listOrgIntegrations"),
      syncIntegration: (integrationId: string) => this.syncIntegrationById(integrationId),
    };
  }

  private async syncIntegrationById(integrationId: string): Promise<SyncIntegrationResult> {
    const url = `${this.baseUrl}/api/integrations/org/${integrationId}/sync`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `Sync failed: ${response.status}`,
        response.status,
        errorText
      );
    }

    return response.json() as Promise<SyncIntegrationResult>;
  }

  get clusters() {
    return {
      list: () => this.query<ClusterSummary[]>("clusters.list"),
      byId: (id: string) => this.query<Cluster>("clusters.byId", id),
      nodes: (clusterId: string) => this.query<ClusterNode[]>("clusters.nodes", clusterId),
      health: () => this.query<ClusterHealth>("clusters.health"),
      costs: (input?: CostsInput) => this.query<ClusterCosts>("clusters.costs", input),
      scale: (input: ScaleInput) => this.mutate<ScaleResult>("clusters.scale", input),
    };
  }

  get infrastructure() {
    return {
      repositories: (input?: RepositoriesInput) => this.query<Repository[]>("infrastructure.repositories", input),
      repository: (name: string) => this.query<Repository>("infrastructure.repository", name),
      images: (input?: ImagesInput) => this.query<ContainerImage[]>("infrastructure.images", input),
      image: (name: string) => this.query<ContainerImage>("infrastructure.image", name),
      servers: () => this.query<Server[]>("infrastructure.servers"),
      server: (id: string) => this.query<Server>("infrastructure.server", id),
      health: () => this.query<InfrastructureHealth>("infrastructure.health"),
      serverPower: (input: ServerPowerInput) => this.mutate<ActionResult>("infrastructure.serverPower", input),
      deleteImageTag: (input: DeleteImageTagInput) => this.mutate<ActionResult>("infrastructure.deleteImageTag", input),
    };
  }

  get deployments() {
    return {
      list: (input?: DeploymentsInput) => this.query<Deployment[]>("deployments.list", input),
      byId: (id: string) => this.query<Deployment>("deployments.byId", id),
      stats: (input?: StatsInput) => this.query<DeploymentStats>("deployments.stats", input),
      trigger: (input: TriggerDeploymentInput) => this.mutate<TriggerResult>("deployments.trigger", input),
      rollback: (input: RollbackInput) => this.mutate<RollbackResult>("deployments.rollback", input),
      cancel: (id: string) => this.mutate<ActionResult>("deployments.cancel", id),
    };
  }

  get monitoring() {
    return {
      alerts: (input?: AlertsInput) => this.query<Alert[]>("monitoring.alerts", input),
      alertById: (id: string) => this.query<Alert>("monitoring.alertById", id),
      alertStats: () => this.query<AlertStats>("monitoring.alertStats"),
      acknowledgeAlert: (input: AcknowledgeAlertInput) => this.mutate<ActionResult>("monitoring.acknowledgeAlert", input),
      metrics: () => this.query<Metric[]>("monitoring.metrics"),
      services: () => this.query<ServiceHealth[]>("monitoring.services"),
      serviceByName: (name: string) => this.query<ServiceHealth>("monitoring.serviceByName", name),
      healthSummary: () => this.query<HealthSummary>("monitoring.healthSummary"),
    };
  }

  get activity() {
    return {
      recent: (input?: ActivityInput) => this.query<ActivityEvent[]>("activity.recent", input),
      stats: () => this.query<ActivityStats>("activity.stats"),
    };
  }

  get notifications() {
    return {
      list: (input?: NotificationsInput) => this.query<NotificationsResponse>("notifications.list", input),
      byId: (id: string) => this.query<Notification>("notifications.byId", id),
      unreadCount: () => this.query<number>("notifications.unreadCount"),
      stats: () => this.query<NotificationStats>("notifications.stats"),
      markAsRead: (id: string) => this.mutate<ActionResult>("notifications.markAsRead", id),
      markAllAsRead: () => this.mutate<{ success: boolean; count: number }>("notifications.markAllAsRead"),
    };
  }

  get aiDev() {
    return {
      list: (input?: AiDevListInput) => this.query<AiDevSession[]>("aiDev.list", input),
      byId: (id: string) => this.query<AiDevSession>("aiDev.byId", id),
      stats: () => this.query<AiDevStats>("aiDev.stats"),
      activeSessions: () => this.query<AiDevSession[]>("aiDev.activeSessions"),
      logs: (input: AiDevLogsInput) => this.query<AiDevLog[]>("aiDev.logs", input),
      comments: (sessionId: string) => this.query<AiDevComment[]>("aiDev.comments", sessionId),
      create: (input: CreateAiDevSessionInput) => this.mutate<AiDevSession>("aiDev.create", input),
      updateStatus: (input: UpdateAiDevStatusInput) => this.mutate<AiDevSession>("aiDev.updateStatus", input),
      approve: (id: string) => this.mutate<AiDevSession>("aiDev.approve", { id }),
      reject: (input: RejectAiDevInput) => this.mutate<AiDevSession>("aiDev.reject", input),
      cancel: (id: string) => this.mutate<AiDevSession>("aiDev.cancel", id),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.monitoring.healthSummary();
      return true;
    } catch {
      return false;
    }
  }
}

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  repositoryUrl?: string | null;
  localRepoPath?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationHealth {
  id: string;
  name: string;
  slug: string;
  status: "critical" | "warning" | "healthy";
  alertCounts: { critical: number; warning: number };
  latestAlert: { message: string; severity: string; timestamp: Date } | null;
  lastActivity: Date;
}

export interface CreateApplicationInput {
  name: string;
  slug: string;
  description?: string;
  repositoryUrl?: string;
}

export interface UpdateApplicationInput {
  id: string;
  name?: string;
  description?: string;
  repositoryUrl?: string;
  localRepoPath?: string;
  status?: string;
}

export interface DiscoverInput {
  unlinkedOnly?: boolean;
}

export interface DiscoveredResource {
  id: string;
  provider: string;
  resourceType: string;
  resourceId: string;
  name: string;
  metadata: Record<string, unknown>;
  applicationId: string | null;
  integrationId: string;
}

export interface DiscoverResult {
  total: number;
  unlinked: number;
  byProvider: Record<string, DiscoveredResource[]>;
  resources: DiscoveredResource[];
}

export interface ApplicationResource {
  provider: string;
  resourceType: string;
  resourceId: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface ApplicationResourcesResult {
  application: Application;
  resources: ApplicationResource[];
  integrations: { provider: string; name: string; enabled: boolean; hasCredentials: boolean }[];
  summary: {
    totalResources: number;
    totalIntegrations: number;
    byProvider: Record<string, number>;
  };
}

export interface LinkResourcesInput {
  applicationId: string;
  resources: { provider: string; resourceId: string }[];
}

export interface LinkResourcesResult {
  linked: number;
  failed: number;
  errors: string[];
}

export interface IntegrationSecret {
  provider: string;
  integrationName: string;
  secrets: { key: string; value: string; description?: string }[];
}

export interface ApplicationSecretsResult {
  applicationId: string;
  applicationName: string;
  secrets: IntegrationSecret[];
  totalSecrets: number;
}

export interface ExportEnvInput {
  applicationId: string;
  format?: "dotenv" | "json" | "yaml";
}

export interface ExportEnvResult {
  applicationId: string;
  applicationName: string;
  format: string;
  content: string;
  variableCount: number;
}

export interface OrgIntegrationSummary {
  id: string;
  provider: string;
  name: string;
  description: string | null;
  enabled: boolean;
  hasCredentials: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
}

export interface ClusterSummary {
  id: string;
  name: string;
  provider: string;
  region: string;
  version: string;
  status: "healthy" | "degraded" | "unhealthy";
  nodeCount: number;
  createdAt: string;
}

export interface Cluster extends ClusterSummary {
  nodes: ClusterNode[];
}

export interface ClusterNode {
  id: string;
  name: string;
  status: "ready" | "not_ready" | "unknown";
  role: "control-plane" | "worker";
  ip: string;
  cpu: { used: number; total: number };
  memory: { used: number; total: number };
  pods: { running: number; total: number };
  createdAt: string;
}

export interface ClusterHealth {
  totalClusters: number;
  healthyClusters: number;
  totalNodes: number;
  readyNodes: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
}

export interface CostsInput {
  clusterId?: string;
  period?: "day" | "week" | "month";
}

export interface ClusterCosts {
  period: string;
  totalCost: number;
  currency: string;
  breakdown: { resource: string; cost: number; hours: number }[];
  trend: { change: number; direction: "up" | "down" };
}

export interface ScaleInput {
  clusterId: string;
  nodeCount: number;
}

export interface ScaleResult {
  success: boolean;
  message: string;
  clusterId: string;
  targetNodeCount: number;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RepositoriesInput {
  limit?: number;
  owner?: string;
}

export interface ContainerImage {
  id: string;
  name: string;
  repository: string;
  tags: string[];
  size: number;
  digest: string;
  pushedAt: string;
  pullCount: number;
}

export interface ImagesInput {
  limit?: number;
  repository?: string;
}

export interface Server {
  id: string;
  name: string;
  status: "running" | "starting" | "stopping" | "off";
  type: string;
  datacenter: string;
  publicIp: string;
  privateIp: string;
  cpu: number;
  memory: number;
  disk: number;
  monthlyPrice: number;
  createdAt: string;
}

export interface InfrastructureHealth {
  gitea: { status: "healthy" | "degraded" | "unhealthy"; repositoryCount: number; lastSync: string };
  harbor: { status: "healthy" | "degraded" | "unhealthy"; imageCount: number; storageUsed: number; lastSync: string };
  hetzner: { status: "healthy" | "degraded" | "unhealthy"; serverCount: number; runningServers: number; totalMonthlyCost: number };
}

export interface ServerPowerInput {
  serverId: string;
  action: "start" | "stop" | "reboot";
}

export interface DeleteImageTagInput {
  repository: string;
  tag: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface Deployment {
  id: string;
  appId: string;
  appName: string;
  version: string;
  environment: "development" | "staging" | "production";
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  triggeredBy: string;
  commitSha: string;
  commitMessage: string;
  imageTag: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface DeploymentsInput {
  limit?: number;
  environment?: "development" | "staging" | "production";
  status?: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  appId?: string;
}

export interface StatsInput {
  period?: "day" | "week" | "month";
}

export interface DeploymentStats {
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  pending: number;
  successRate: number;
  avgDuration: number;
  byEnvironment: { production: number; staging: number; development: number };
}

export interface TriggerDeploymentInput {
  appId: string;
  environment: "development" | "staging" | "production";
  imageTag?: string;
  commitSha?: string;
}

export interface TriggerResult {
  success: boolean;
  deployment: Deployment;
}

export interface RollbackInput {
  deploymentId: string;
  targetVersion?: string;
}

export interface RollbackResult {
  success: boolean;
  message: string;
  rollbackDeploymentId: string;
}

export interface Alert {
  id: string;
  name: string;
  severity: "critical" | "warning" | "info";
  status: "firing" | "resolved" | "acknowledged";
  source: string;
  message: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AlertsInput {
  status?: "firing" | "resolved" | "acknowledged";
  severity?: "critical" | "warning" | "info";
  limit?: number;
}

export interface AlertStats {
  total: number;
  firing: number;
  acknowledged: number;
  resolved: number;
  bySeverity: { critical: number; warning: number; info: number };
}

export interface AcknowledgeAlertInput {
  alertId: string;
  comment?: string;
}

export interface Metric {
  name: string;
  value: number;
  unit: string;
  change: number;
  status: "healthy" | "warning" | "critical";
}

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency: number;
  uptime: number;
  lastCheck: string;
  endpoints: { name: string; url: string; status: "up" | "down"; responseTime: number }[];
}

export interface HealthSummary {
  status: "healthy" | "degraded" | "unhealthy";
  services: { total: number; healthy: number; degraded: number; unhealthy: number };
  alerts: { critical: number; warning: number; total: number };
  metrics: { avgCpu: number; avgMemory: number; errorRate: number };
}

export interface ActivityEvent {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  source: string;
  appId?: string;
  userId?: string;
  timestamp: Date;
  links?: { label: string; url: string }[];
  metadata?: Record<string, unknown>;
}

export interface ActivityInput {
  limit?: number;
}

export interface ActivityStats {
  total: number;
  last24h: number;
  last7d: number;
  bySeverity: Record<string, number>;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  status: string;
  appId?: string;
  source?: string;
  actionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationsInput {
  limit?: number;
  offset?: number;
  statuses?: string[];
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  hasMore: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  last24h: number;
  last7d: number;
}

export type AiDevStatus = 
  | "pending" | "cloning" | "analyzing" | "fixing" | "testing" 
  | "review" | "approved" | "merged" | "failed" | "cancelled";

export interface AiDevSession {
  id: string;
  issueSource: "sentry" | "posthog" | "manual";
  issueId: string;
  issueTitle: string;
  issueUrl?: string;
  issueSeverity?: "fatal" | "error" | "warning";
  applicationId?: string;
  applicationName?: string;
  repositoryUrl: string;
  branch: string;
  agentType: "claude" | "kiro" | "codex" | "opencode" | "cursor";
  status: AiDevStatus;
  worktreeId?: string;
  agentInstanceId?: string;
  analysisResult?: string;
  proposedFix?: string;
  filesChanged?: string[];
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  prStatus?: "open" | "merged" | "closed";
  errorMessage?: string;
  rejectionReason?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AiDevListInput {
  limit?: number;
  status?: AiDevStatus;
  applicationId?: string;
}

export interface AiDevStats {
  total: number;
  pending: number;
  inReview: number;
  completed: number;
  failed: number;
  successRate: number;
  last7Days: number;
}

export interface AiDevLog {
  id: string;
  sessionId: string;
  level: "info" | "warn" | "error" | "debug";
  phase: string;
  message: string;
  details?: string;
  progress?: number;
  timestamp: Date;
}

export interface AiDevLogsInput {
  sessionId: string;
  limit?: number;
}

export interface AiDevComment {
  id: string;
  sessionId: string;
  authorType: string;
  authorId?: string;
  content: string;
  filePath?: string;
  lineNumber?: number;
  createdAt: Date;
}

export interface CreateAiDevSessionInput {
  issueSource: "sentry" | "posthog" | "manual";
  issueId: string;
  issueTitle: string;
  issueUrl?: string;
  issueSeverity?: "fatal" | "error" | "warning";
  applicationId?: string;
  applicationName?: string;
  repositoryUrl: string;
  branch?: string;
  agentType?: "claude" | "kiro" | "codex" | "opencode" | "cursor";
}

export interface UpdateAiDevStatusInput {
  id: string;
  status: AiDevStatus;
  worktreeId?: string;
  agentInstanceId?: string;
  analysisResult?: string;
  proposedFix?: string;
  filesChanged?: string[];
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  prStatus?: "open" | "merged" | "closed";
  errorMessage?: string;
}

export interface RejectAiDevInput {
  id: string;
  reason: string;
}

export interface SyncIntegrationResult {
  success: boolean;
  projectsCount: number;
  projects: unknown[];
  error?: string;
  details?: string;
}

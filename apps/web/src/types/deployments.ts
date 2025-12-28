export interface Deployment {
  id: string;
  applicationId: string;
  environment: 'staging' | 'production';
  version: string;
  commitSha: string;
  commitMessage?: string;
  commitAuthor?: string;
  imageTag: string;
  imageDigest?: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  health: DeploymentHealth;
  pods: Pod[];
  pipeline: Pipeline;
  createdAt: string;
  updatedAt: string;
  deployedAt?: string;
  deployedBy?: string;
}

export interface Pod {
  id: string;
  name: string;
  namespace: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'unknown';
  ready: boolean;
  restarts: number;
  age: string;
  cpu: {
    usage: number;
    limit: number;
    request: number;
  };
  memory: {
    usage: number;
    limit: number;
    request: number;
  };
  containers: Container[];
  events: PodEvent[];
  node?: string;
  ip?: string;
}

export interface Container {
  name: string;
  image: string;
  imageID: string;
  state: 'waiting' | 'running' | 'terminated';
  ready: boolean;
  restartCount: number;
  started?: string;
  lastState?: {
    terminated?: {
      exitCode: number;
      reason: string;
      startedAt: string;
      finishedAt: string;
    };
  };
}

export interface PodEvent {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
}

export interface DeploymentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  checks: HealthCheck[];
  lastChecked: string;
}

export interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'exec' | 'grpc';
  status: 'passing' | 'warning' | 'critical' | 'unknown';
  message?: string;
  lastChecked: string;
  duration?: number;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  triggeredBy?: string;
  trigger: 'manual' | 'commit' | 'tag' | 'schedule' | 'api';
}

export interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  steps: PipelineStep[];
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
}

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  command?: string;
  output?: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  exitCode?: number;
}

export interface DeploymentMetrics {
  cpu: TimeSeriesMetric[];
  memory: TimeSeriesMetric[];
  requests: TimeSeriesMetric[];
  errors: TimeSeriesMetric[];
  latency: TimeSeriesMetric[];
}

export interface TimeSeriesMetric {
  timestamp: string;
  value: number;
}

export interface CreateDeploymentRequest {
  applicationId: string;
  environment: 'staging' | 'production';
  version: string;
  commitSha: string;
  commitMessage?: string;
  imageTag: string;
  pipeline?: {
    name: string;
    trigger: Pipeline['trigger'];
  };
}

export interface K3sDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  image: string;
  labels: Record<string, string>;
  creationTimestamp: string;
  conditions: K8sCondition[];
}

export interface K8sCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime: string;
}

export interface GiteaWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  created_at: string;
  updated_at: string;
  run_number: number;
  event: string;
  actor: {
    login: string;
    id: number;
    avatar_url: string;
  };
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  head_commit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
  };
  jobs?: GiteaWorkflowJob[];
}

export interface GiteaWorkflowJob {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  started_at?: string;
  completed_at?: string;
  steps: GiteaWorkflowStep[];
}

export interface GiteaWorkflowStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  number: number;
  started_at?: string;
  completed_at?: string;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  repository: {
    owner: string;
    name: string;
    url: string;
  };
  giteaRepo?: {
    owner: string;
    name: string;
  };
  environments?: string[];
  status?: 'active' | 'inactive' | 'archived';
  lastDeployment?: {
    version: string;
    timestamp: string;
    environment: string;
  };
}

export interface ClusterInfo {
  name: string;
  provider: 'k3s' | 'k8s';
  region: string;
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  nodes: {
    total: number;
    ready: number;
  };
  resources: {
    cpu: {
      total: number;
      used: number;
      percentage: number;
    };
    memory: {
      total: number;
      used: number;
      percentage: number;
    };
  };
}

export interface DeploymentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: 'application' | 'kubernetes' | 'gitea' | 'system';
  metadata?: Record<string, any>;
}

export interface DeploymentEvent {
  type: 'deployment_started' | 'deployment_completed' | 'deployment_failed' | 'rollback_started' | 'rollback_completed';
  deploymentId: string;
  timestamp: Date;
  data: Record<string, any>;
}
export type InfrastructureType = 'k3s' | 'gitea-vps';

export interface Infrastructure {
  id: string;
  name: string;
  type: InfrastructureType;
  status: 'active' | 'provisioning' | 'error' | 'stopped';
  endpoint: string;
  created: Date;
  updated: Date;
  config: K3sInfraConfig | GiteaVPSInfraConfig;
  resources?: {
    nodes?: number;
    cpu?: number;
    memory?: number;
    storage?: number;
  };
  cost?: {
    hourly: number;
    monthly: number;
    currency: string;
  };
}

export interface K3sInfraConfig {
  type: 'k3s';
  clusterName: string;
  masterNodes: number;
  workerNodes: number;
  serverType: string;
  location: string;
  features: {
    autoscaling: boolean;
    monitoring: boolean;
    registry: boolean;
    ingress: boolean;
  };
}

export interface GiteaVPSInfraConfig {
  type: 'gitea-vps';
  serverName: string;
  serverType: string;
  location: string;
  domain: string;
  features: {
    actions: boolean;
    registry: boolean;
    packages: boolean;
    lfs: boolean;
  };
}

export interface ApplicationDeployment {
  id: string;
  applicationId: string;
  infrastructureId: string;
  infrastructureType: InfrastructureType;
  environment: 'production' | 'staging' | 'development';
  status: 'running' | 'stopped' | 'deploying' | 'failed';
  version: string;
  url?: string;
  created: Date;
  updated: Date;
  
  // Git information
  git?: {
    repository: string;
    branch: string;
    commit: string;
    author: string;
    message: string;
  };
  
  // CI/CD information
  cicd?: {
    provider: 'gitea-actions' | 'github-actions' | 'none';
    workflowId?: string;
    runId?: string;
    status?: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'cancelled';
    duration?: number;
    logs?: string;
  };
  
  // Registry information
  registry?: {
    provider: 'harbor' | 'gitea' | 'dockerhub';
    image: string;
    tag: string;
    digest?: string;
    size?: number;
    layers?: number;
    vulnerabilities?: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  
  // Runtime information
  runtime?: {
    replicas: number;
    cpu: {
      requested: number;
      limit: number;
      usage: number;
    };
    memory: {
      requested: number;
      limit: number;
      usage: number;
    };
    storage?: {
      size: number;
      usage: number;
    };
  };
}

export interface UnifiedApplication {
  id: string;
  name: string;
  description?: string;
  type: 'web' | 'api' | 'worker' | 'database' | 'other';
  framework?: string;
  language?: string;
  created: Date;
  updated: Date;
  
  // Deployments across different infrastructures
  deployments: ApplicationDeployment[];
  
  // Source control
  repository?: {
    provider: 'gitea' | 'github' | 'gitlab';
    url: string;
    private: boolean;
    defaultBranch: string;
    branches: string[];
    lastCommit?: {
      sha: string;
      message: string;
      author: string;
      date: Date;
    };
  };
  
  // Secrets and configuration
  secrets?: Array<{
    name: string;
    created: Date;
    updated: Date;
  }>;
  
  // Monitoring
  monitoring?: {
    enabled: boolean;
    provider: 'prometheus' | 'datadog' | 'newrelic';
    dashboardUrl?: string;
    alerts: Array<{
      name: string;
      severity: 'critical' | 'warning' | 'info';
      status: 'firing' | 'resolved';
      message: string;
    }>;
  };
  
  // Cost tracking
  cost?: {
    total: number;
    breakdown: {
      compute: number;
      storage: number;
      network: number;
      other: number;
    };
    trend: 'up' | 'down' | 'stable';
    currency: string;
  };
}
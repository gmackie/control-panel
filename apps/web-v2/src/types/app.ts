export type AppStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
export type DeployProvider = "k8s" | "vercel";
export type GitProvider = "gitea" | "github";

export interface AppEnvironment {
  name: string;
  provider: DeployProvider;
  status: AppStatus;
  podCount?: { ready: number; total: number };
  vercelStatus?: string;
  version?: string;
  lastDeployedAt?: string;
}

export interface AppSummary {
  id: string;
  name: string;
  slug: string;
  gitProvider: GitProvider;
  deployProviders: DeployProvider[];
  branch: string;
  latestCommit?: {
    sha: string;
    message: string;
    timestamp: string;
  };
  environments: AppEnvironment[];
  metrics?: {
    cpuPercent: number;
    memPercent: number;
    errorRate: number;
    p95Latency: number;
  };
  status: AppStatus;
}

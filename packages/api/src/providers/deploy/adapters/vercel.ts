import { createProviderError } from '../../types';
import type { EnvVar, Environment } from '../../types';
import type { DeploymentProvider } from '../index';
import type {
  Deployment,
  DeploymentProject,
  DeployOptions,
  RollbackOptions,
  CreateProjectOptions,
  LinkGitRepoOptions,
  ListDeploymentsOptions,
  ListDeploymentsResponse,
  LogEntry,
  LogStreamOptions,
  DeploymentStatus,
} from '../types';

interface VercelConfig {
  token: string;
  teamId?: string;
}

const VERCEL_API = 'https://api.vercel.com';

export class VercelProvider implements DeploymentProvider {
  readonly type = 'vercel' as const;
  private token: string;
  private teamId?: string;

  constructor(config: VercelConfig) {
    this.token = config.token;
    this.teamId = config.teamId;
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    const url = new URL(path, VERCEL_API);
    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }

    const response = await fetch(url.toString(), {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw this.createApiError(response.status, error.error?.message ?? response.statusText, path);
    }

    return response.json() as Promise<T>;
  }

  async listProjects(): Promise<DeploymentProject[]> {
    const data = await this.request<{ projects: VercelProject[] }>('/v9/projects?limit=100');
    return data.projects.map(this.mapProject);
  }

  async getProject(projectId: string): Promise<DeploymentProject> {
    const data = await this.request<VercelProject>(`/v9/projects/${projectId}`);
    return this.mapProject(data);
  }

  async getProjectByName(name: string): Promise<DeploymentProject | null> {
    try {
      return await this.getProject(name);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const body: Record<string, unknown> = {
      name: options.name,
      framework: options.framework,
      buildCommand: options.buildCommand,
      outputDirectory: options.outputDirectory,
      installCommand: options.installCommand,
      rootDirectory: options.rootDirectory,
    };

    if (options.gitRepo) {
      body.gitRepository = {
        repo: `${options.gitRepo.owner}/${options.gitRepo.name}`,
        type: options.gitRepo.provider,
      };
    }

    const data = await this.request<VercelProject>('/v10/projects', {
      method: 'POST',
      body,
    });
    return this.mapProject(data);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}`, { method: 'DELETE' });
  }

  async linkGitRepo(projectId: string, options: LinkGitRepoOptions): Promise<void> {
    await this.request(`/v9/projects/${projectId}/link`, {
      method: 'POST',
      body: {
        type: options.provider,
        repo: `${options.owner}/${options.name}`,
        productionBranch: options.productionBranch,
      },
    });
  }

  async unlinkGitRepo(projectId: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}/link`, { method: 'DELETE' });
  }

  async deploy(projectId: string, options?: DeployOptions): Promise<Deployment> {
    const project = await this.getProject(projectId);
    
    const body: Record<string, unknown> = {
      name: project.name,
      project: projectId,
      target: options?.environment === 'production' ? 'production' : undefined,
    };

    if (options?.branch || options?.commitSha) {
      body.gitSource = {
        type: 'github',
        ref: options.branch ?? options.commitSha,
      };
    }

    const data = await this.request<VercelDeployment>('/v13/deployments', {
      method: 'POST',
      body,
    });
    return this.mapDeployment(data);
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    const data = await this.request<VercelDeployment>(`/v13/deployments/${deploymentId}`);
    return this.mapDeployment(data);
  }

  async listDeployments(
    projectId: string,
    options?: ListDeploymentsOptions
  ): Promise<ListDeploymentsResponse> {
    const params = new URLSearchParams();
    params.set('projectId', projectId);
    params.set('limit', String(options?.perPage ?? 20));
    
    if (options?.environment) {
      params.set('target', options.environment === 'production' ? 'production' : 'preview');
    }
    if (options?.status) {
      params.set('state', this.mapStatusToState(options.status));
    }

    const data = await this.request<{ deployments: VercelDeployment[]; pagination?: { next?: number } }>(
      `/v6/deployments?${params.toString()}`
    );

    return {
      data: data.deployments.map(this.mapDeployment),
      pagination: {
        page: options?.page ?? 1,
        perPage: options?.perPage ?? 20,
        total: data.deployments.length,
        totalPages: 1,
        hasNextPage: !!data.pagination?.next,
        hasPrevPage: false,
        nextCursor: data.pagination?.next?.toString(),
      },
    };
  }

  async cancelDeployment(deploymentId: string): Promise<void> {
    await this.request(`/v12/deployments/${deploymentId}/cancel`, { method: 'PATCH' });
  }

  async rollback(projectId: string, options: RollbackOptions): Promise<Deployment> {
    await this.request(`/v9/projects/${projectId}/rollback/${options.targetDeploymentId}`, {
      method: 'POST',
    });
    return this.getDeployment(options.targetDeploymentId);
  }

  async *getLogs(deploymentId: string, _options?: LogStreamOptions): AsyncIterable<LogEntry> {
    const data = await this.request<{ logs: VercelLogEntry[] }>(`/v2/deployments/${deploymentId}/events`);
    
    for (const log of data.logs ?? []) {
      yield {
        timestamp: new Date(log.created ?? Date.now()),
        level: log.type === 'error' ? 'error' : log.type === 'warning' ? 'warn' : 'info',
        message: log.text ?? '',
        source: log.source,
      };
    }
  }

  async getBuildLogs(deploymentId: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];
    for await (const log of this.getLogs(deploymentId)) {
      logs.push(log);
    }
    return logs;
  }

  async getEnvVars(projectId: string, environment?: Environment): Promise<EnvVar[]> {
    const data = await this.request<{ envs: VercelEnvVar[] }>(`/v10/projects/${projectId}/env`);
    
    const envs = data.envs.map((env): EnvVar => ({
      key: env.key,
      value: env.value ?? '',
      target: env.target?.map(t => t === 'preview' ? 'staging' : t) as Environment[],
      isSecret: env.type === 'secret',
    }));

    if (environment) {
      const targetEnv = environment === 'staging' ? 'preview' : environment;
      return envs.filter(e => !e.target || e.target.length === 0 || e.target.includes(targetEnv as Environment));
    }
    return envs;
  }

  async setEnvVars(
    projectId: string,
    envVars: EnvVar[],
    environment?: Environment
  ): Promise<void> {
    for (const envVar of envVars) {
      const target = envVar.target ?? (environment ? [environment] : ['production', 'preview', 'development']);
      
      await this.request(`/v10/projects/${projectId}/env?upsert=true`, {
        method: 'POST',
        body: {
          key: envVar.key,
          value: envVar.value,
          type: envVar.isSecret ? 'secret' : 'plain',
          target: target.map(t => t === 'staging' ? 'preview' : t),
        },
      });
    }
  }

  async deleteEnvVar(
    projectId: string,
    key: string,
    _environment?: Environment
  ): Promise<void> {
    const envs = await this.request<{ envs: VercelEnvVar[] }>(`/v10/projects/${projectId}/env`);
    const env = envs.envs.find(e => e.key === key);
    if (env?.id) {
      await this.request(`/v10/projects/${projectId}/env/${env.id}`, { method: 'DELETE' });
    }
  }

  async getDomains(projectId: string): Promise<string[]> {
    const data = await this.request<{ domains: { name: string }[] }>(`/v9/projects/${projectId}/domains`);
    return data.domains.map(d => d.name);
  }

  async addDomain(projectId: string, domain: string): Promise<void> {
    await this.request(`/v10/projects/${projectId}/domains`, {
      method: 'POST',
      body: { name: domain },
    });
  }

  async removeDomain(projectId: string, domain: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}/domains/${domain}`, { method: 'DELETE' });
  }

  private mapProject = (project: VercelProject): DeploymentProject => {
    const gitRepo = project.link ? {
      owner: project.link.repo?.split('/')[0] ?? '',
      name: project.link.repo?.split('/')[1] ?? '',
      url: `https://github.com/${project.link.repo}`,
    } : null;

    return {
      id: project.id,
      name: project.name,
      slug: project.name,
      framework: project.framework ?? null,
      gitRepo,
      domains: project.alias?.map(a => typeof a === 'string' ? a : a.domain) ?? [],
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt ?? project.createdAt),
    };
  };

  private mapDeployment = (deployment: VercelDeployment): Deployment => {
    const status = this.mapStateToStatus(deployment.state ?? deployment.readyState);

    return {
      id: deployment.uid ?? deployment.id ?? '',
      name: deployment.name,
      status,
      environment: deployment.target === 'production' ? 'production' : 'preview',
      url: deployment.url ? `https://${deployment.url}` : null,
      commitSha: deployment.meta?.githubCommitSha ?? null,
      commitMessage: deployment.meta?.githubCommitMessage ?? null,
      branch: deployment.meta?.githubCommitRef ?? null,
      triggeredBy: deployment.creator ? {
        id: deployment.creator.uid,
        name: deployment.creator.username ?? deployment.creator.email ?? 'Unknown',
      } : null,
      startedAt: deployment.buildingAt ? new Date(deployment.buildingAt) : null,
      completedAt: deployment.ready ? new Date(deployment.ready) : null,
      errorMessage: status === 'error' ? 'Deployment failed' : null,
      createdAt: new Date(deployment.createdAt),
      updatedAt: new Date(deployment.ready ?? deployment.buildingAt ?? deployment.createdAt),
    };
  };

  private mapStateToStatus(state?: string): DeploymentStatus {
    switch (state?.toUpperCase()) {
      case 'QUEUED':
      case 'INITIALIZING':
        return 'queued';
      case 'BUILDING':
        return 'building';
      case 'DEPLOYING':
        return 'deploying';
      case 'READY':
        return 'ready';
      case 'ERROR':
      case 'FAILED':
        return 'error';
      case 'CANCELED':
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'queued';
    }
  }

  private mapStatusToState(status: DeploymentStatus): string {
    switch (status) {
      case 'queued': return 'QUEUED';
      case 'building': return 'BUILDING';
      case 'deploying': return 'DEPLOYING';
      case 'ready': return 'READY';
      case 'error': return 'ERROR';
      case 'cancelled': return 'CANCELED';
      default: return 'QUEUED';
    }
  }

  private createApiError(status: number, message: string, path: string): never {
    if (status === 401) {
      throw createProviderError('vercel', 'UNAUTHORIZED', 'Invalid or expired Vercel token', { statusCode: 401 });
    }
    if (status === 403) {
      throw createProviderError('vercel', 'FORBIDDEN', `Access denied: ${message}`, { statusCode: 403 });
    }
    if (status === 404) {
      throw createProviderError('vercel', 'NOT_FOUND', `Resource not found: ${message}`, { statusCode: 404 });
    }
    if (status === 400) {
      throw createProviderError('vercel', 'VALIDATION_ERROR', `Invalid request: ${message}`, { statusCode: 400 });
    }
    throw createProviderError('vercel', 'API_ERROR', `Vercel API error (${path}): ${message}`, {
      statusCode: status,
      retryable: status >= 500,
    });
  }
}

interface VercelProject {
  id: string;
  name: string;
  framework?: string | null;
  link?: { type: string; repo?: string };
  alias?: (string | { domain: string })[];
  createdAt: number;
  updatedAt?: number;
}

interface VercelDeployment {
  uid?: string;
  id?: string;
  name: string;
  state?: string;
  readyState?: string;
  url?: string;
  target?: string;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitRef?: string;
  };
  creator?: { uid: string; username?: string; email?: string };
  createdAt: number;
  buildingAt?: number;
  ready?: number;
}

interface VercelEnvVar {
  id: string;
  key: string;
  value?: string;
  type: string;
  target?: string[];
}

interface VercelLogEntry {
  created?: number;
  type?: string;
  text?: string;
  source?: string;
}

export function createVercelProvider(config: VercelConfig): VercelProvider {
  return new VercelProvider(config);
}

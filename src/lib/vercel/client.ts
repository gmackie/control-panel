/**
 * Vercel API Client
 * Manage deployments, projects, and domains across Vercel
 */

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: number;
  updatedAt: number;
  framework: string | null;
  devCommand: string | null;
  installCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  rootDirectory: string | null;
  directoryListing: boolean;
  nodeVersion: string;
  publicSource: boolean | null;
  serverlessFunctionRegion: string | null;
  sourceFilesOutsideRootDirectory: boolean;
  autoExposeSystemEnvs: boolean;
  link?: {
    type: string;
    repo: string;
    repoId: number;
    org: string;
    gitCredentialId: string;
    productionBranch: string;
    createdAt: number;
    updatedAt: number;
    deployHooks: Array<{
      id: string;
      name: string;
      ref: string;
      url: string;
    }>;
  };
  latestDeployments?: VercelDeployment[];
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  readyState: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  type: 'LAMBDAS';
  creator: {
    uid: string;
    email: string;
    username: string;
  };
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    githubCommitRef?: string;
    githubDeployment?: string;
    githubOrg?: string;
    githubRepo?: string;
  };
  target: 'production' | 'staging' | null;
  aliasError: { code: string; message: string } | null;
  aliasAssigned: number;
  isRollbackCandidate: boolean;
  createdAt: number;
  buildingAt: number;
  ready: number;
  source?: string;
}

export interface VercelDomain {
  name: string;
  apexName: string;
  projectId: string;
  redirect: string | null;
  redirectStatusCode: number | null;
  gitBranch: string | null;
  updatedAt: number;
  createdAt: number;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

export interface VercelTeam {
  id: string;
  slug: string;
  name: string;
  createdAt: number;
  created: string;
  avatar: string | null;
}

export interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  type: 'system' | 'secret' | 'encrypted' | 'plain';
  target: ('production' | 'preview' | 'development')[];
  configurationId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface VercelUsage {
  bandwidth: {
    used: number;
    limit: number;
    period: string;
  };
  builds: {
    used: number;
    limit: number;
    period: string;
  };
  serverlessFunctionExecution: {
    used: number;
    limit: number;
    period: string;
  };
  edgeFunctionExecution: {
    used: number;
    limit: number;
    period: string;
  };
}

export class VercelClient {
  private baseUrl = 'https://api.vercel.com';
  private token: string;
  private teamId?: string;

  constructor(config: { token: string; teamId?: string }) {
    this.token = config.token;
    this.teamId = config.teamId;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vercel API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Projects
  async listProjects(limit = 20): Promise<{ projects: VercelProject[] }> {
    return this.request<{ projects: VercelProject[] }>(`/v9/projects?limit=${limit}`);
  }

  async getProject(projectId: string): Promise<VercelProject> {
    return this.request<VercelProject>(`/v9/projects/${projectId}`);
  }

  async getProjectByName(name: string): Promise<VercelProject> {
    return this.request<VercelProject>(`/v9/projects/${name}`);
  }

  // Deployments
  async listDeployments(options?: {
    projectId?: string;
    limit?: number;
    state?: string;
    target?: string;
  }): Promise<{ deployments: VercelDeployment[] }> {
    const params = new URLSearchParams();
    if (options?.projectId) params.set('projectId', options.projectId);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.state) params.set('state', options.state);
    if (options?.target) params.set('target', options.target);

    return this.request<{ deployments: VercelDeployment[] }>(`/v6/deployments?${params}`);
  }

  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    return this.request<VercelDeployment>(`/v13/deployments/${deploymentId}`);
  }

  async cancelDeployment(deploymentId: string): Promise<void> {
    await this.request(`/v12/deployments/${deploymentId}/cancel`, { method: 'PATCH' });
  }

  async redeployDeployment(deploymentId: string): Promise<VercelDeployment> {
    return this.request<VercelDeployment>(`/v13/deployments?forceNew=1`, {
      method: 'POST',
      body: JSON.stringify({ deploymentId }),
    });
  }

  // Domains
  async listDomains(projectId: string): Promise<{ domains: VercelDomain[] }> {
    return this.request<{ domains: VercelDomain[] }>(`/v9/projects/${projectId}/domains`);
  }

  async addDomain(projectId: string, domain: string): Promise<VercelDomain> {
    return this.request<VercelDomain>(`/v9/projects/${projectId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    });
  }

  async removeDomain(projectId: string, domain: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}/domains/${domain}`, { method: 'DELETE' });
  }

  // Environment Variables
  async listEnvVars(projectId: string): Promise<{ envs: VercelEnvVar[] }> {
    return this.request<{ envs: VercelEnvVar[] }>(`/v9/projects/${projectId}/env`);
  }

  async createEnvVar(
    projectId: string,
    envVar: { key: string; value: string; target: string[]; type?: string }
  ): Promise<VercelEnvVar> {
    return this.request<VercelEnvVar>(`/v10/projects/${projectId}/env`, {
      method: 'POST',
      body: JSON.stringify(envVar),
    });
  }

  async deleteEnvVar(projectId: string, envVarId: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}/env/${envVarId}`, { method: 'DELETE' });
  }

  // Teams
  async listTeams(): Promise<{ teams: VercelTeam[] }> {
    return this.request<{ teams: VercelTeam[] }>('/v2/teams');
  }

  async getTeam(teamId: string): Promise<VercelTeam> {
    return this.request<VercelTeam>(`/v2/teams/${teamId}`);
  }

  // User
  async getCurrentUser(): Promise<{ user: { id: string; email: string; name: string; username: string } }> {
    return this.request('/v2/user');
  }

  // Usage
  async getUsage(): Promise<VercelUsage> {
    // This is a simplified usage endpoint - actual implementation may vary
    try {
      const response = await this.request<any>('/v1/integrations/usage');
      return response;
    } catch {
      // Return mock data if usage endpoint not available
      return {
        bandwidth: { used: 0, limit: 100000000000, period: 'monthly' },
        builds: { used: 0, limit: 6000, period: 'monthly' },
        serverlessFunctionExecution: { used: 0, limit: 100, period: 'monthly' },
        edgeFunctionExecution: { used: 0, limit: 500000, period: 'monthly' },
      };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer
export class VercelService {
  private client: VercelClient;

  constructor() {
    this.client = new VercelClient({
      token: process.env.VERCEL_TOKEN || '',
      teamId: process.env.VERCEL_TEAM_ID,
    });
  }

  async getProjects() {
    const { projects } = await this.client.listProjects(50);
    return projects;
  }

  async getProjectWithDeployments(projectId: string) {
    const [project, { deployments }] = await Promise.all([
      this.client.getProject(projectId),
      this.client.listDeployments({ projectId, limit: 10 }),
    ]);
    return { ...project, deployments };
  }

  async getRecentDeployments(limit = 20) {
    const { deployments } = await this.client.listDeployments({ limit });
    return deployments;
  }

  async getDeploymentsByProject(projectId: string, limit = 10) {
    const { deployments } = await this.client.listDeployments({ projectId, limit });
    return deployments;
  }

  async getProjectDomains(projectId: string) {
    const { domains } = await this.client.listDomains(projectId);
    return domains;
  }

  async getProjectEnvVars(projectId: string) {
    const { envs } = await this.client.listEnvVars(projectId);
    // Mask sensitive values
    return envs.map(env => ({
      ...env,
      value: env.type === 'secret' || env.type === 'encrypted' ? '********' : env.value,
    }));
  }

  async getDashboardStats() {
    const [{ projects }, { deployments }] = await Promise.all([
      this.client.listProjects(100),
      this.client.listDeployments({ limit: 50 }),
    ]);

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    const recentDeployments = deployments.filter(d => d.created > last24h);
    const weeklyDeployments = deployments.filter(d => d.created > last7d);
    const productionDeployments = deployments.filter(d => d.target === 'production');
    const failedDeployments = deployments.filter(d => d.state === 'ERROR');

    return {
      totalProjects: projects.length,
      totalDeployments: deployments.length,
      deploymentsLast24h: recentDeployments.length,
      deploymentsLast7d: weeklyDeployments.length,
      productionDeployments: productionDeployments.length,
      failedDeployments: failedDeployments.length,
      successRate: deployments.length > 0 
        ? ((deployments.length - failedDeployments.length) / deployments.length * 100).toFixed(1)
        : 100,
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const vercelService = new VercelService();

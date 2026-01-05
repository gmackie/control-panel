export interface LinearCloneConfig {
  baseUrl: string;
  apiKey: string;
}

export interface LinearCloneIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface LinearCloneProject {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: string;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinearCloneCycle {
  id: string;
  name: string | null;
  number: number;
  status: string;
  startDate: string;
  endDate: string;
  progress: number;
  createdAt: string;
}

export interface LinearCloneWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface LinearCloneUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string | null;
}

export class LinearCloneClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: LinearCloneConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(procedure: string, input?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/trpc/${procedure}`);
    
    if (input) {
      url.searchParams.set('input', JSON.stringify(input));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Linear Clone API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.result?.data as T;
  }

  private async mutate<T>(procedure: string, input: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/trpc/${procedure}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Linear Clone API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.result?.data as T;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        headers: { 'x-api-key': this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getCurrentUser(): Promise<LinearCloneUser | null> {
    try {
      return await this.request<LinearCloneUser>('user.me');
    } catch {
      return null;
    }
  }

  async getWorkspaces(): Promise<LinearCloneWorkspace[]> {
    const result = await this.request<Array<{ workspace: LinearCloneWorkspace }>>('workspace.list');
    return result.map(r => r.workspace);
  }

  async getProjects(workspaceId: string): Promise<LinearCloneProject[]> {
    return this.request<LinearCloneProject[]>('project.list', { workspaceId });
  }

  async getIssues(options: { projectId?: string; workspaceId?: string; status?: string; limit?: number } = {}): Promise<LinearCloneIssue[]> {
    return this.request<LinearCloneIssue[]>('issue.list', options);
  }

  async getIssue(id: string): Promise<LinearCloneIssue | null> {
    return this.request<LinearCloneIssue | null>('issue.get', { id });
  }

  async createIssue(data: {
    projectId: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    labelIds?: string[];
  }): Promise<LinearCloneIssue> {
    return this.mutate<LinearCloneIssue>('issue.create', data);
  }

  async updateIssue(id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
  }): Promise<LinearCloneIssue> {
    return this.mutate<LinearCloneIssue>('issue.update', { id, ...data });
  }

  async getCycles(workspaceId: string): Promise<LinearCloneCycle[]> {
    return this.request<LinearCloneCycle[]>('cycle.listByWorkspace', { workspaceId });
  }

  async getStats(workspaceId: string): Promise<{
    totalIssues: number;
    openIssues: number;
    completedIssues: number;
    totalProjects: number;
    activeCycles: number;
  }> {
    const [issues, projects, cycles] = await Promise.all([
      this.getIssues({ workspaceId }),
      this.getProjects(workspaceId),
      this.getCycles(workspaceId),
    ]);

    const openStatuses = ['backlog', 'todo', 'in_progress', 'in_review'];
    const completedStatuses = ['done'];

    return {
      totalIssues: issues.length,
      openIssues: issues.filter(i => openStatuses.includes(i.status)).length,
      completedIssues: issues.filter(i => completedStatuses.includes(i.status)).length,
      totalProjects: projects.length,
      activeCycles: cycles.filter(c => c.status === 'active').length,
    };
  }
}

export function createLinearCloneClient(): LinearCloneClient {
  const baseUrl = process.env.LINEAR_CLONE_URL || 'https://tasks.gmac.io';
  const apiKey = process.env.LINEAR_CLONE_API_KEY || '';

  if (!apiKey) {
    throw new Error('LINEAR_CLONE_API_KEY environment variable is required');
  }

  return new LinearCloneClient({ baseUrl, apiKey });
}

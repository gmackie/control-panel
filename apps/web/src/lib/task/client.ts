const DEFAULT_TASK_API_URL = process.env.TASK_API_URL || 'https://task.gmac.io';

export interface TaskConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface TaskUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface TaskTeam {
  id: string;
  name: string;
  key: string;
  color?: string | null;
}

export interface TaskProject {
  id: string;
  name: string;
  key: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  workspaceId: string;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
  description?: string | null;
}

export interface TaskCycle {
  id: string;
  name: string;
  number: number;
  status: 'planned' | 'active' | 'completed';
  startDate?: Date | null;
  endDate?: Date | null;
}

export type TaskIssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled';
export type TaskIssuePriority = 'no_priority' | 'urgent' | 'high' | 'medium' | 'low';
export type TaskIssueType = 'issue' | 'bug' | 'feature' | 'epic';

export interface TaskIssue {
  id: string;
  identifier: string;
  number: number;
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  type: TaskIssueType;
  status: TaskIssueStatus;
  priority: TaskIssuePriority;
  projectId: string;
  project?: TaskProject;
  teamId?: string | null;
  team?: TaskTeam | null;
  assigneeId?: string | null;
  assignee?: TaskUser | null;
  creatorId: string;
  creator?: TaskUser;
  cycleId?: string | null;
  cycle?: TaskCycle | null;
  parentId?: string | null;
  epicId?: string | null;
  estimate?: number | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  sortOrder: number;
  trashed: boolean;
  labels?: TaskLabel[];
  gitLinks?: {
    prs: number;
    commits: number;
    mergedPrs: number;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
}

export interface TaskIssueInput {
  projectId: string;
  title: string;
  description?: string;
  type?: TaskIssueType;
  status?: TaskIssueStatus;
  priority?: TaskIssuePriority;
  assigneeId?: string;
  teamId?: string;
  cycleId?: string;
  parentId?: string;
  epicId?: string;
  estimate?: number;
  storyPoints?: number;
  dueDate?: string;
  labelIds?: string[];
}

export interface TaskIssueUpdateInput {
  title?: string;
  description?: string | null;
  type?: TaskIssueType;
  status?: TaskIssueStatus;
  priority?: TaskIssuePriority;
  assigneeId?: string | null;
  teamId?: string | null;
  projectId?: string;
  cycleId?: string | null;
  parentId?: string | null;
  epicId?: string | null;
  estimate?: number | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  sortOrder?: number;
  trashed?: boolean;
}

export interface TaskIssueFilter {
  projectId?: string;
  teamId?: string;
  cycleId?: string;
  assigneeId?: string;
  creatorId?: string;
  epicId?: string | null;
  type?: TaskIssueType[];
  status?: TaskIssueStatus[];
  priority?: TaskIssuePriority[];
  labelIds?: string[];
  parentId?: string | null;
  search?: string;
  trashed?: boolean;
  dueBefore?: string;
  dueAfter?: string;
}

export interface TaskPagination {
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'dueDate' | 'sortOrder' | 'status';
  sortDirection?: 'asc' | 'desc';
}

export interface TaskWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface TRPCResponse<T> {
  result?: {
    data: T;
  };
  error?: {
    message: string;
    code: string;
    data?: unknown;
  };
}

export class TaskClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: Partial<TaskConfig>) {
    this.apiKey = config?.apiKey || process.env.LINEAR_CLONE_API_KEY || process.env.TASK_API_KEY || '';
    this.baseUrl = config?.baseUrl || DEFAULT_TASK_API_URL;
    
    if (!this.apiKey) {
      console.warn('[TaskClient] No API key provided');
    }
  }

  private async query<T>(
    procedure: string,
    input?: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`/api/trpc/${procedure}`, this.baseUrl);
    
    if (input) {
      url.searchParams.set('input', JSON.stringify(input));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Task API error: ${response.status} ${response.statusText} - ${text}`);
    }

    const result: TRPCResponse<T> = await response.json();

    if (result.error) {
      throw new Error(`Task API error: ${result.error.message}`);
    }

    if (!result.result?.data) {
      throw new Error('Task API returned no data');
    }

    return result.result.data;
  }

  private async mutate<T>(
    procedure: string,
    input: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`/api/trpc/${procedure}`, this.baseUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Task API error: ${response.status} ${response.statusText} - ${text}`);
    }

    const result: TRPCResponse<T> = await response.json();

    if (result.error) {
      throw new Error(`Task API error: ${result.error.message}`);
    }

    if (!result.result?.data) {
      throw new Error('Task API returned no data');
    }

    return result.result.data;
  }

  async getWorkspaces(): Promise<TaskWorkspace[]> {
    return this.query<TaskWorkspace[]>('workspace.list');
  }

  async getWorkspace(id: string): Promise<TaskWorkspace | null> {
    return this.query<TaskWorkspace | null>('workspace.get', { id });
  }

  async getTeams(workspaceId: string): Promise<TaskTeam[]> {
    return this.query<TaskTeam[]>('team.list', { workspaceId });
  }

  async getTeam(id: string): Promise<TaskTeam | null> {
    return this.query<TaskTeam | null>('team.get', { id });
  }

  async getProjects(workspaceId: string): Promise<TaskProject[]> {
    return this.query<TaskProject[]>('project.list', { workspaceId });
  }

  async getProject(id: string): Promise<TaskProject | null> {
    return this.query<TaskProject | null>('project.get', { id });
  }

  async getLabels(workspaceId: string): Promise<TaskLabel[]> {
    return this.query<TaskLabel[]>('label.list', { workspaceId });
  }

  async getCycles(projectId: string): Promise<TaskCycle[]> {
    return this.query<TaskCycle[]>('cycle.list', { projectId });
  }

  async getActiveCycle(projectId: string): Promise<TaskCycle | null> {
    return this.query<TaskCycle | null>('cycle.getActive', { projectId });
  }

  async getIssues(options: {
    workspaceId: string;
    filter?: TaskIssueFilter;
    pagination?: TaskPagination;
  }): Promise<TaskIssue[]> {
    return this.query<TaskIssue[]>('issue.list', options);
  }

  async getIssuesByStatus(options: {
    workspaceId: string;
    projectId?: string;
  }): Promise<Record<TaskIssueStatus, TaskIssue[]>> {
    return this.query<Record<TaskIssueStatus, TaskIssue[]>>('issue.listByStatus', options);
  }

  async getIssue(id: string): Promise<TaskIssue | null> {
    return this.query<TaskIssue | null>('issue.get', { id });
  }

  async getIssueByIdentifier(identifier: string, workspaceId?: string): Promise<TaskIssue | null> {
    return this.query<TaskIssue | null>('issue.getByIdentifier', { identifier, workspaceId });
  }

  async createIssue(input: TaskIssueInput): Promise<TaskIssue> {
    return this.mutate<TaskIssue>('issue.create', input as unknown as Record<string, unknown>);
  }

  async updateIssue(id: string, input: TaskIssueUpdateInput): Promise<TaskIssue> {
    return this.mutate<TaskIssue>('issue.update', { id, ...input } as Record<string, unknown>);
  }

  async deleteIssue(id: string, permanent = false): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>('issue.delete', { id, permanent });
  }

  async restoreIssue(id: string): Promise<TaskIssue> {
    return this.mutate<TaskIssue>('issue.restore', { id });
  }

  async moveIssueToStatus(
    issueId: string,
    status: TaskIssueStatus,
    sortOrder?: number
  ): Promise<TaskIssue> {
    return this.mutate<TaskIssue>('issue.moveToStatus', { issueId, status, sortOrder });
  }

  async bulkUpdateIssues(
    issueIds: string[],
    data: Partial<TaskIssueUpdateInput>
  ): Promise<{ success: boolean; count: number }> {
    return this.mutate<{ success: boolean; count: number }>('issue.bulkUpdate', {
      issueIds,
      data,
    });
  }

  async setIssueLabels(issueId: string, labelIds: string[]): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>('issue.setLabels', { issueId, labelIds });
  }

  async addIssueLabel(issueId: string, labelId: string): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>('issue.addLabel', { issueId, labelId });
  }

  async removeIssueLabel(issueId: string, labelId: string): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>('issue.removeLabel', { issueId, labelId });
  }

  async getSubIssues(parentId: string): Promise<TaskIssue[]> {
    return this.query<TaskIssue[]>('issue.subIssues', { parentId });
  }

  async getEpicIssues(epicId: string): Promise<TaskIssue[]> {
    return this.query<TaskIssue[]>('issue.epicIssues', { epicId });
  }

  async listEpics(workspaceId: string, projectId?: string): Promise<TaskIssue[]> {
    return this.query<TaskIssue[]>('issue.listEpics', { workspaceId, projectId });
  }

  async getIssueActivity(issueId: string): Promise<unknown[]> {
    return this.query<unknown[]>('issue.activity', { issueId });
  }

  async subscribeToIssue(issueId: string): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>('issue.subscribe', { issueId });
  }

  async unsubscribeFromIssue(issueId: string): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>('issue.unsubscribe', { issueId });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getWorkspaces();
      return true;
    } catch {
      return false;
    }
  }
}

let taskClientInstance: TaskClient | null = null;

export function getTaskClient(config?: Partial<TaskConfig>): TaskClient {
  if (!taskClientInstance || config) {
    taskClientInstance = new TaskClient(config);
  }
  return taskClientInstance;
}

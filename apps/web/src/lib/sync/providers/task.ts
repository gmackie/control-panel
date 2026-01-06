import { TaskClient, type TaskIssue, type TaskIssueStatus, type TaskIssuePriority } from '../../task/client';
import {
  SyncProviderAdapter,
  type ProviderAdapterConfig,
  type BatchSyncResult,
  type SyncItemResult,
} from './base';
import type {
  ExternalTaskData,
  TaskCreateInput,
  TaskUpdateInput,
  TaskStatus,
  TaskPriority,
  TaskProviderConfig,
} from '../types';

export interface TaskAdapterConfig extends ProviderAdapterConfig {
  config: TaskProviderConfig;
}

const TASK_PRIORITY_MAP: Record<TaskIssuePriority, TaskPriority | undefined> = {
  no_priority: undefined,
  urgent: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const UNIFIED_PRIORITY_TO_TASK: Record<TaskPriority, TaskIssuePriority> = {
  urgent: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const TASK_STATUS_MAP: Record<TaskIssueStatus, TaskStatus> = {
  backlog: 'backlog',
  todo: 'todo',
  in_progress: 'in_progress',
  in_review: 'in_review',
  done: 'done',
  canceled: 'cancelled',
};

const UNIFIED_STATUS_TO_TASK: Record<TaskStatus, TaskIssueStatus> = {
  backlog: 'backlog',
  todo: 'todo',
  in_progress: 'in_progress',
  in_review: 'in_review',
  done: 'done',
  cancelled: 'canceled',
};

export class TaskSyncAdapter extends SyncProviderAdapter {
  private client: TaskClient;
  private workspaceId: string;
  private projectId?: string;
  private labelsCache: Map<string, string> = new Map();

  constructor(config: TaskAdapterConfig) {
    super(config);
    this.client = new TaskClient();
    this.workspaceId = config.config.workspaceId;
    this.projectId = config.config.projectId;
  }

  async pullTasks(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalTaskData>> {
    try {
      const issues = await this.client.getIssues({
        workspaceId: this.workspaceId,
        filter: this.projectId ? { projectId: this.projectId } : undefined,
        pagination: {
          limit: options?.limit || 50,
          offset: options?.cursor ? parseInt(options.cursor, 10) : 0,
        },
      });

      const items = issues.map((issue) => this.mapIssueToTask(issue));
      const nextOffset = (options?.cursor ? parseInt(options.cursor, 10) : 0) + issues.length;

      return {
        items,
        errors: [],
        hasMore: issues.length === (options?.limit || 50),
        cursor: items.length > 0 ? String(nextOffset) : undefined,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull tasks from Task' }],
        hasMore: false,
      };
    }
  }

  async pullTask(externalId: string): Promise<ExternalTaskData | null> {
    try {
      const issue = await this.client.getIssue(externalId);
      return issue ? this.mapIssueToTask(issue) : null;
    } catch {
      return null;
    }
  }

  async pushTask(task: TaskCreateInput): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      if (!this.projectId) {
        return {
          success: false,
          error: 'Project ID is required to create tasks in Task',
        };
      }

      const labelIds = await this.resolveLabelIds(task.labels || []);

      const issue = await this.client.createIssue({
        projectId: this.projectId,
        title: task.title,
        description: task.description,
        status: task.status ? UNIFIED_STATUS_TO_TASK[task.status] : undefined,
        priority: task.priority ? UNIFIED_PRIORITY_TO_TASK[task.priority] : undefined,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        dueDate: task.dueDate?.toISOString().split('T')[0],
      });

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create issue on Task',
      };
    }
  }

  async updateTask(
    externalId: string,
    task: TaskUpdateInput
  ): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const updateInput: {
        title?: string;
        description?: string | null;
        status?: TaskIssueStatus;
        priority?: TaskIssuePriority;
        dueDate?: string | null;
      } = {};

      if (task.title) updateInput.title = task.title;
      if (task.description !== undefined) updateInput.description = task.description || null;
      if (task.status) updateInput.status = UNIFIED_STATUS_TO_TASK[task.status];
      if (task.priority !== undefined) {
        updateInput.priority = task.priority ? UNIFIED_PRIORITY_TO_TASK[task.priority] : 'no_priority';
      }
      if (task.dueDate !== undefined) {
        updateInput.dueDate = task.dueDate?.toISOString().split('T')[0] || null;
      }

      const issue = await this.client.updateIssue(externalId, updateInput);

      if (task.labels) {
        const labelIds = await this.resolveLabelIds(task.labels);
        await this.client.setIssueLabels(externalId, labelIds);
      }

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update issue on Task',
      };
    }
  }

  async deleteTask(externalId: string): Promise<SyncItemResult<void>> {
    try {
      const result = await this.client.deleteIssue(externalId);
      return { success: result.success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete issue on Task',
      };
    }
  }

  async closeTask(externalId: string): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const issue = await this.client.moveIssueToStatus(externalId, 'done');
      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close issue on Task',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }

  private async resolveLabelIds(labelNames: string[]): Promise<string[]> {
    if (labelNames.length === 0) return [];

    try {
      if (this.labelsCache.size === 0) {
        const labels = await this.client.getLabels(this.workspaceId);
        for (const label of labels) {
          this.labelsCache.set(label.name.toLowerCase(), label.id);
        }
      }

      const labelIds: string[] = [];
      for (const name of labelNames) {
        const id = this.labelsCache.get(name.toLowerCase());
        if (id) {
          labelIds.push(id);
        }
      }

      return labelIds;
    } catch {
      return [];
    }
  }

  private mapIssueToTask(issue: TaskIssue): ExternalTaskData {
    const baseUrl = process.env.TASK_API_URL || 'https://task.gmac.io';
    const issueUrl = `${baseUrl}/issue/${issue.identifier}`;

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      description: issue.description || undefined,
      status: TASK_STATUS_MAP[issue.status],
      priority: TASK_PRIORITY_MAP[issue.priority],
      assignee: issue.assignee?.name,
      labels: issue.labels?.map((label) => label.name) || [],
      url: issueUrl,
      createdAt: new Date(issue.createdAt),
      updatedAt: new Date(issue.updatedAt),
      closedAt: issue.completedAt ? new Date(issue.completedAt) : 
                issue.canceledAt ? new Date(issue.canceledAt) : undefined,
    };
  }

  protected mapToUnifiedStatus(providerStatus: string): TaskStatus {
    return TASK_STATUS_MAP[providerStatus as TaskIssueStatus] || 'todo';
  }

  protected mapToProviderStatus(status: TaskStatus): string {
    return UNIFIED_STATUS_TO_TASK[status];
  }

  getExternalLinkData(issue: ExternalTaskData): {
    id: string;
    identifier?: string;
    url: string;
  } {
    return {
      id: issue.id,
      url: issue.url,
    };
  }
}

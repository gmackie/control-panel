/**
 * Notion Sync Provider Adapter
 * 
 * Syncs tasks with Notion databases.
 * Notion does not support releases, so those methods are not implemented.
 */

import {
  NotionClient,
  type NotionTask,
  type NotionTaskStatus,
  type NotionTaskPriority,
} from '../../notion/client';
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
  NotionProviderConfig,
} from '../types';

/**
 * Notion-specific adapter configuration
 */
export interface NotionAdapterConfig extends ProviderAdapterConfig {
  config: NotionProviderConfig & {
    apiToken?: string;
  };
}

/**
 * Mapping between Notion status and unified TaskStatus
 */
const NOTION_STATUS_TO_UNIFIED: Record<NotionTaskStatus, TaskStatus> = {
  not_started: 'todo',
  in_progress: 'in_progress',
  done: 'done',
  blocked: 'in_review', // Using in_review as closest equivalent
  cancelled: 'cancelled',
};

const UNIFIED_STATUS_TO_NOTION: Record<TaskStatus, NotionTaskStatus> = {
  backlog: 'not_started',
  todo: 'not_started',
  in_progress: 'in_progress',
  in_review: 'in_progress', // Notion doesn't have in_review
  done: 'done',
  cancelled: 'cancelled',
};

/**
 * Mapping between Notion priority and unified TaskPriority
 */
const NOTION_PRIORITY_TO_UNIFIED: Record<NotionTaskPriority, TaskPriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
};

const UNIFIED_PRIORITY_TO_NOTION: Record<TaskPriority, NotionTaskPriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
};

export class NotionSyncAdapter extends SyncProviderAdapter {
  private client: NotionClient;
  private databaseId: string;

  constructor(config: NotionAdapterConfig) {
    super(config);
    const token = config.config.apiToken || process.env.NOTION_API_TOKEN;
    if (!token) {
      throw new Error('Notion API token is required');
    }
    this.client = new NotionClient(token);
    this.databaseId = config.config.databaseId;
  }

  // ===================================
  // Task Operations
  // ===================================

  async pullTasks(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalTaskData>> {
    try {
      const result = await this.client.queryTasks(this.databaseId, {
        pageSize: options?.limit || 100,
        startCursor: options?.cursor,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      });

      const items = result.tasks.map((task) => this.mapNotionTaskToExternal(task));

      return {
        items,
        errors: [],
        hasMore: result.hasMore,
        cursor: result.nextCursor,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull tasks from Notion' }],
        hasMore: false,
      };
    }
  }

  async pullTask(externalId: string): Promise<ExternalTaskData | null> {
    try {
      const task = await this.client.getTask(externalId);
      return this.mapNotionTaskToExternal(task);
    } catch {
      return null;
    }
  }

  async pushTask(task: TaskCreateInput): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const notionTask = await this.client.createTask(this.databaseId, task.title, {
        status: task.status ? UNIFIED_STATUS_TO_NOTION[task.status] : undefined,
        priority: task.priority ? UNIFIED_PRIORITY_TO_NOTION[task.priority] : undefined,
        dueDate: task.dueDate?.toISOString().split('T')[0],
        description: task.description,
        tags: task.labels,
      });

      return {
        success: true,
        data: this.mapNotionTaskToExternal(notionTask),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task in Notion',
      };
    }
  }

  async updateTask(
    externalId: string,
    task: TaskUpdateInput
  ): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const updatePayload: {
        status?: NotionTaskStatus;
        priority?: NotionTaskPriority;
        dueDate?: string;
      } = {};

      if (task.status) {
        updatePayload.status = UNIFIED_STATUS_TO_NOTION[task.status];
      }
      if (task.priority) {
        updatePayload.priority = UNIFIED_PRIORITY_TO_NOTION[task.priority];
      }
      if (task.dueDate !== undefined) {
        updatePayload.dueDate = task.dueDate?.toISOString().split('T')[0];
      }

      const notionTask = await this.client.updateTask(externalId, updatePayload);

      return {
        success: true,
        data: this.mapNotionTaskToExternal(notionTask),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task in Notion',
      };
    }
  }

  async deleteTask(_externalId: string): Promise<SyncItemResult<void>> {
    // Notion doesn't support deleting pages via API easily
    // Archive the task by setting status to cancelled
    const result = await this.closeTask(_externalId);
    return {
      success: result.success,
      error: result.error,
    };
  }

  async closeTask(externalId: string): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const notionTask = await this.client.updateTask(externalId, {
        status: 'done',
      });

      return {
        success: true,
        data: this.mapNotionTaskToExternal(notionTask),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close task in Notion',
      };
    }
  }

  // ===================================
  // Health Check
  // ===================================

  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }

  // ===================================
  // Mapping Helpers
  // ===================================

  private mapNotionTaskToExternal(task: NotionTask): ExternalTaskData {
    return {
      id: task.notionPageId,
      title: task.title,
      description: task.description,
      status: this.mapToUnifiedStatus(task.status),
      priority: task.priority ? NOTION_PRIORITY_TO_UNIFIED[task.priority] : undefined,
      assignee: task.assignee,
      labels: task.tags || [],
      url: task.url,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      closedAt: task.status === 'done' ? new Date(task.updatedAt) : undefined,
    };
  }

  protected mapToUnifiedStatus(providerStatus: string): TaskStatus {
    const notionStatus = providerStatus as NotionTaskStatus;
    return NOTION_STATUS_TO_UNIFIED[notionStatus] || 'todo';
  }

  protected mapToProviderStatus(status: TaskStatus): string {
    return UNIFIED_STATUS_TO_NOTION[status];
  }

  /**
   * Get the external link data for storing in the task record
   */
  getExternalLinkData(task: ExternalTaskData): {
    pageId: string;
    url: string;
  } {
    return {
      pageId: task.id,
      url: task.url,
    };
  }
}

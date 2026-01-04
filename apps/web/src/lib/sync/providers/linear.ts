/**
 * Linear Sync Provider Adapter
 * 
 * Syncs tasks (issues) with Linear.
 * Linear does not support releases, so those methods are not implemented.
 */

import { LinearClient, type LinearIssue, type LinearWorkflowState } from '../../linear/client';
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
  LinearProviderConfig,
} from '../types';

/**
 * Linear-specific adapter configuration
 */
export interface LinearAdapterConfig extends ProviderAdapterConfig {
  config: LinearProviderConfig;
}

/**
 * Linear priority values (0=none, 1=urgent, 2=high, 3=medium, 4=low)
 */
const LINEAR_PRIORITY_MAP: Record<number, TaskPriority> = {
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
};

const TASK_PRIORITY_TO_LINEAR: Record<TaskPriority, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export class LinearSyncAdapter extends SyncProviderAdapter {
  private client: LinearClient;
  private teamId: string;
  private projectId?: string;
  private workflowStates: LinearWorkflowState[] = [];
  private workflowStatesLoaded = false;

  constructor(config: LinearAdapterConfig) {
    super(config);
    this.client = new LinearClient();
    this.teamId = config.config.teamId;
    this.projectId = config.config.projectId;
  }

  /**
   * Ensure workflow states are loaded for status mapping
   */
  private async ensureWorkflowStatesLoaded(): Promise<void> {
    if (this.workflowStatesLoaded) return;

    try {
      this.workflowStates = await this.client.getWorkflowStates(this.teamId);
      this.workflowStatesLoaded = true;
    } catch (error) {
      console.error('Failed to load Linear workflow states:', error);
      this.workflowStates = [];
    }
  }

  // ===================================
  // Task Operations
  // ===================================

  async pullTasks(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalTaskData>> {
    try {
      await this.ensureWorkflowStatesLoaded();

      const result = await this.client.getIssues({
        teamId: this.teamId,
        projectId: this.projectId,
        first: options?.limit || 50,
        after: options?.cursor,
      });

      const items = result.issues.map((issue) => this.mapIssueToTask(issue));

      return {
        items,
        errors: [],
        hasMore: result.hasMore,
        cursor: result.endCursor,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull tasks from Linear' }],
        hasMore: false,
      };
    }
  }

  async pullTask(externalId: string): Promise<ExternalTaskData | null> {
    try {
      await this.ensureWorkflowStatesLoaded();
      const issue = await this.client.getIssue(externalId);
      return issue ? this.mapIssueToTask(issue) : null;
    } catch {
      return null;
    }
  }

  async pushTask(task: TaskCreateInput): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      await this.ensureWorkflowStatesLoaded();

      // Get the state ID for the initial status
      const stateId = task.status ? this.getStateIdForStatus(task.status) : undefined;
      
      // Get label IDs if labels are provided
      const labelIds = await this.resolveLabelIds(task.labels || []);

      const issue = await this.client.createIssue({
        title: task.title,
        description: task.description,
        teamId: this.teamId,
        projectId: this.projectId,
        stateId,
        priority: task.priority ? TASK_PRIORITY_TO_LINEAR[task.priority] : undefined,
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
        error: error instanceof Error ? error.message : 'Failed to create issue on Linear',
      };
    }
  }

  async updateTask(
    externalId: string,
    task: TaskUpdateInput
  ): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      await this.ensureWorkflowStatesLoaded();

      const updateInput: {
        title?: string;
        description?: string;
        stateId?: string;
        priority?: number;
        labelIds?: string[];
        dueDate?: string;
      } = {};

      if (task.title) updateInput.title = task.title;
      if (task.description !== undefined) updateInput.description = task.description;
      if (task.status) {
        const stateId = this.getStateIdForStatus(task.status);
        if (stateId) updateInput.stateId = stateId;
      }
      if (task.priority !== undefined) {
        updateInput.priority = task.priority ? TASK_PRIORITY_TO_LINEAR[task.priority] : 0;
      }
      if (task.labels) {
        updateInput.labelIds = await this.resolveLabelIds(task.labels);
      }
      if (task.dueDate !== undefined) {
        updateInput.dueDate = task.dueDate?.toISOString().split('T')[0];
      }

      const issue = await this.client.updateIssue(externalId, updateInput);

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update issue on Linear',
      };
    }
  }

  async deleteTask(externalId: string): Promise<SyncItemResult<void>> {
    try {
      const success = await this.client.deleteIssue(externalId);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete issue on Linear',
      };
    }
  }

  async closeTask(externalId: string): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      await this.ensureWorkflowStatesLoaded();

      // Find a completed state
      const completedState = this.workflowStates.find((s) => s.type === 'completed');
      if (!completedState) {
        return {
          success: false,
          error: 'No completed workflow state found for this team',
        };
      }

      const issue = await this.client.updateIssue(externalId, {
        stateId: completedState.id,
      });

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close issue on Linear',
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
  // Helper Methods
  // ===================================

  private async resolveLabelIds(labelNames: string[]): Promise<string[]> {
    if (labelNames.length === 0) return [];

    try {
      const labels = await this.client.getLabels(this.teamId);
      const labelIds: string[] = [];

      for (const name of labelNames) {
        const existing = labels.find(
          (l) => l.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          labelIds.push(existing.id);
        }
        // Note: Linear's label creation requires team context and is more complex,
        // so we only match existing labels for now
      }

      return labelIds;
    } catch {
      return [];
    }
  }

  private getStateIdForStatus(status: TaskStatus): string | undefined {
    const typeMapping: Record<TaskStatus, LinearWorkflowState['type'][]> = {
      backlog: ['backlog'],
      todo: ['unstarted'],
      in_progress: ['started'],
      in_review: ['started'],
      done: ['completed'],
      cancelled: ['canceled'],
    };

    const targetTypes = typeMapping[status];
    const state = this.workflowStates.find((s) => targetTypes.includes(s.type));
    return state?.id;
  }

  // ===================================
  // Mapping Helpers
  // ===================================

  private mapIssueToTask(issue: LinearIssue): ExternalTaskData {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: this.mapToUnifiedStatus(issue.state.type),
      priority: this.mapLinearPriorityToUnified(issue.priority),
      assignee: issue.assignee?.name,
      labels: issue.labels.nodes.map((label) => label.name),
      url: issue.url,
      createdAt: new Date(issue.createdAt),
      updatedAt: new Date(issue.updatedAt),
      // Linear doesn't have a closedAt field, but we can infer from state
      closedAt: ['completed', 'canceled'].includes(issue.state.type)
        ? new Date(issue.updatedAt)
        : undefined,
    };
  }

  private mapLinearPriorityToUnified(priority: number): TaskPriority | undefined {
    return LINEAR_PRIORITY_MAP[priority];
  }

  protected mapToUnifiedStatus(providerStatus: string): TaskStatus {
    switch (providerStatus) {
      case 'backlog':
        return 'backlog';
      case 'unstarted':
        return 'todo';
      case 'started':
        return 'in_progress';
      case 'completed':
        return 'done';
      case 'canceled':
        return 'cancelled';
      default:
        return 'todo';
    }
  }

  protected mapToProviderStatus(status: TaskStatus): string {
    switch (status) {
      case 'backlog':
        return 'backlog';
      case 'todo':
        return 'unstarted';
      case 'in_progress':
      case 'in_review':
        return 'started';
      case 'done':
        return 'completed';
      case 'cancelled':
        return 'canceled';
      default:
        return 'unstarted';
    }
  }

  /**
   * Get the external link data for storing in the task record
   */
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

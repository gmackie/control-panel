/**
 * Task Sync Engine
 * 
 * Central orchestration for syncing tasks between Control Panel and external providers.
 * Control Panel is the source of truth - when conflicts occur, Control Panel wins.
 */

import { db, eq, and, inArray } from '@repo/db';
import {
  tasks,
  taskSyncConfigs,
  taskActivityLog,
  type Task,
  type NewTask,
  type TaskSyncConfig,
} from '@repo/db';

import type {
  SyncProvider,
  SyncResult,
  SyncError,
  ExternalTaskData,
  TaskStatus,
  SyncDirection,
  GithubProviderConfig,
  GiteaProviderConfig,
  LinearProviderConfig,
  NotionProviderConfig,
} from './types';
import { SyncProviderAdapter } from './providers/base';
import { GitHubSyncAdapter } from './providers/github';
import { GiteaSyncAdapter } from './providers/gitea';
import { LinearSyncAdapter } from './providers/linear';
import { NotionSyncAdapter } from './providers/notion';

/**
 * Result of syncing a single task
 */
interface TaskSyncItemResult {
  taskId: string;
  externalId?: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

/**
 * Factory to create appropriate adapter for a provider
 */
function createAdapter(
  provider: SyncProvider,
  config: Record<string, unknown>
): SyncProviderAdapter {
  switch (provider) {
    case 'github':
      return new GitHubSyncAdapter({
        provider: 'github',
        config: config as GithubProviderConfig,
      });
    case 'gitea':
      return new GiteaSyncAdapter({
        provider: 'gitea',
        config: config as GiteaProviderConfig & { baseUrl: string; token?: string },
      });
    case 'linear':
      return new LinearSyncAdapter({
        provider: 'linear',
        config: config as LinearProviderConfig,
      });
    case 'notion':
      return new NotionSyncAdapter({
        provider: 'notion',
        config: config as NotionProviderConfig,
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Main Task Sync Engine class
 */
export class TaskSyncEngine {
  /**
   * Pull tasks from an external provider and create/update local tasks
   */
  async pullFromProvider(
    applicationId: string,
    provider: SyncProvider
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let tasksCreated = 0;
    let tasksUpdated = 0;

    try {
      // Get sync config for this app/provider
      const syncConfig = await this.getSyncConfig(applicationId, provider);
      if (!syncConfig || !syncConfig.enabled) {
        return {
          success: false,
          provider,
          tasksCreated: 0,
          tasksUpdated: 0,
          tasksPushed: 0,
          errors: [{ message: `Sync not enabled for ${provider}`, code: 'SYNC_DISABLED' }],
          timestamp: new Date(),
        };
      }

      // Check sync direction allows pulling
      if (syncConfig.syncDirection === 'push_only') {
        return {
          success: true,
          provider,
          tasksCreated: 0,
          tasksUpdated: 0,
          tasksPushed: 0,
          errors: [],
          timestamp: new Date(),
        };
      }

      const config = JSON.parse(syncConfig.config || '{}');
      const adapter = createAdapter(provider, config);

      // Pull all tasks from the provider
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await adapter.pullTasks({ cursor, limit: 100 });

        if (result.errors.length > 0) {
          errors.push(
            ...result.errors.map((e) => ({
              message: e.message,
              code: 'PULL_ERROR',
            }))
          );
        }

        // Process each pulled task
        for (const externalTask of result.items) {
          try {
            const syncResult = await this.syncExternalTaskToLocal(
              applicationId,
              provider,
              externalTask
            );

            if (syncResult.action === 'created') tasksCreated++;
            else if (syncResult.action === 'updated') tasksUpdated++;
            else if (syncResult.action === 'failed' && syncResult.error) {
              errors.push({
                externalId: externalTask.id,
                message: syncResult.error,
                code: 'SYNC_ITEM_ERROR',
              });
            }
          } catch (error) {
            errors.push({
              externalId: externalTask.id,
              message: error instanceof Error ? error.message : 'Unknown error',
              code: 'SYNC_ITEM_ERROR',
            });
          }
        }

        hasMore = result.hasMore;
        cursor = result.cursor;
      }

      // Update last sync timestamp
      await this.updateSyncStatus(applicationId, provider, 'success');

      return {
        success: errors.length === 0,
        provider,
        tasksCreated,
        tasksUpdated,
        tasksPushed: 0,
        errors,
        timestamp: new Date(),
      };
    } catch (error) {
      await this.updateSyncStatus(
        applicationId,
        provider,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        provider,
        tasksCreated,
        tasksUpdated,
        tasksPushed: 0,
        errors: [
          ...errors,
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'PULL_FAILED',
          },
        ],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Push a local task to an external provider
   */
  async pushToProvider(
    applicationId: string,
    provider: SyncProvider,
    taskId: string
  ): Promise<SyncResult> {
    const errors: SyncError[] = [];
    let tasksPushed = 0;

    try {
      // Get sync config
      const syncConfig = await this.getSyncConfig(applicationId, provider);
      if (!syncConfig || !syncConfig.enabled) {
        return {
          success: false,
          provider,
          tasksCreated: 0,
          tasksUpdated: 0,
          tasksPushed: 0,
          errors: [{ message: `Sync not enabled for ${provider}`, code: 'SYNC_DISABLED' }],
          timestamp: new Date(),
        };
      }

      // Check sync direction allows pushing
      if (syncConfig.syncDirection === 'pull_only') {
        return {
          success: true,
          provider,
          tasksCreated: 0,
          tasksUpdated: 0,
          tasksPushed: 0,
          errors: [],
          timestamp: new Date(),
        };
      }

      // Get the task
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));

      if (!task) {
        return {
          success: false,
          provider,
          tasksCreated: 0,
          tasksUpdated: 0,
          tasksPushed: 0,
          errors: [{ taskId, message: 'Task not found', code: 'TASK_NOT_FOUND' }],
          timestamp: new Date(),
        };
      }

      const config = JSON.parse(syncConfig.config || '{}');
      const adapter = createAdapter(provider, config);

      // Check if task already has an external link for this provider
      const externalLink = this.getExternalLink(task, provider);

      let result;
      if (externalLink) {
        // Update existing external task
        result = await adapter.updateTask(externalLink.id, {
          title: task.title,
          description: task.description || undefined,
          status: task.status as TaskStatus,
          priority: task.priority as never,
          labels: task.labels ? JSON.parse(task.labels) : undefined,
          dueDate: task.dueDate || undefined,
        });
      } else {
        // Create new external task
        result = await adapter.pushTask({
          title: task.title,
          description: task.description || undefined,
          status: task.status as TaskStatus,
          priority: task.priority as never,
          labels: task.labels ? JSON.parse(task.labels) : undefined,
          dueDate: task.dueDate || undefined,
        });

        // Save the external link
        if (result.success && result.data) {
          await this.saveExternalLink(task.id, provider, result.data);
        }
      }

      if (result.success) {
        tasksPushed = 1;
        await this.updateTaskSyncStatus(taskId, 'synced');
        await this.logActivity(taskId, 'synced', 'sync', provider, {
          externalId: result.data?.id,
        });
      } else {
        errors.push({
          taskId,
          message: result.error || 'Failed to push task',
          code: 'PUSH_FAILED',
        });
        await this.updateTaskSyncStatus(taskId, 'pending_push', result.error);
      }

      return {
        success: errors.length === 0,
        provider,
        tasksCreated: 0,
        tasksUpdated: 0,
        tasksPushed,
        errors,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        provider,
        tasksCreated: 0,
        tasksUpdated: 0,
        tasksPushed: 0,
        errors: [
          {
            taskId,
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'PUSH_FAILED',
          },
        ],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Push all pending local tasks to a provider
   */
  async pushAllPendingToProvider(
    applicationId: string,
    provider: SyncProvider
  ): Promise<SyncResult> {
    const errors: SyncError[] = [];
    let tasksPushed = 0;

    try {
      // Get all tasks that need to be pushed
      const pendingTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.applicationId, applicationId),
            inArray(tasks.syncStatus, ['local_only', 'pending_push'])
          )
        );

      for (const task of pendingTasks) {
        const result = await this.pushToProvider(applicationId, provider, task.id);
        tasksPushed += result.tasksPushed;
        errors.push(...result.errors);
      }

      return {
        success: errors.length === 0,
        provider,
        tasksCreated: 0,
        tasksUpdated: 0,
        tasksPushed,
        errors,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        provider,
        tasksCreated: 0,
        tasksUpdated: 0,
        tasksPushed,
        errors: [
          ...errors,
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'PUSH_ALL_FAILED',
          },
        ],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Full bidirectional sync for an application and provider
   */
  async syncAll(
    applicationId: string,
    provider: SyncProvider
  ): Promise<SyncResult> {
    // Pull first, then push
    const pullResult = await this.pullFromProvider(applicationId, provider);
    const pushResult = await this.pushAllPendingToProvider(applicationId, provider);

    return {
      success: pullResult.success && pushResult.success,
      provider,
      tasksCreated: pullResult.tasksCreated,
      tasksUpdated: pullResult.tasksUpdated,
      tasksPushed: pushResult.tasksPushed,
      errors: [...pullResult.errors, ...pushResult.errors],
      timestamp: new Date(),
    };
  }

  /**
   * Sync all enabled providers for an application
   */
  async syncAllProviders(applicationId: string): Promise<SyncResult[]> {
    const configs = await db
      .select()
      .from(taskSyncConfigs)
      .where(
        and(
          eq(taskSyncConfigs.applicationId, applicationId),
          eq(taskSyncConfigs.enabled, true)
        )
      );

    const results: SyncResult[] = [];
    for (const config of configs) {
      const result = await this.syncAll(applicationId, config.provider as SyncProvider);
      results.push(result);
    }

    return results;
  }

  // ===================================
  // Private Helper Methods
  // ===================================

  private async getSyncConfig(
    applicationId: string,
    provider: SyncProvider
  ): Promise<TaskSyncConfig | null> {
    const [config] = await db
      .select()
      .from(taskSyncConfigs)
      .where(
        and(
          eq(taskSyncConfigs.applicationId, applicationId),
          eq(taskSyncConfigs.provider, provider)
        )
      );
    return config || null;
  }

  private async updateSyncStatus(
    applicationId: string,
    provider: SyncProvider,
    status: 'success' | 'failed' | 'partial',
    error?: string
  ): Promise<void> {
    await db
      .update(taskSyncConfigs)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskSyncConfigs.applicationId, applicationId),
          eq(taskSyncConfigs.provider, provider)
        )
      );
  }

  private async syncExternalTaskToLocal(
    applicationId: string,
    provider: SyncProvider,
    externalTask: ExternalTaskData
  ): Promise<TaskSyncItemResult> {
    // Check if we already have this task synced
    const existingTask = await this.findTaskByExternalId(
      applicationId,
      provider,
      externalTask.id
    );

    if (existingTask) {
      // Task exists - check for conflicts
      // Control Panel wins: only update if external task is newer AND local hasn't been modified
      const localUpdatedAt = existingTask.updatedAt.getTime();
      const externalUpdatedAt = externalTask.updatedAt.getTime();

      // If local was modified more recently, skip (Control Panel wins)
      if (localUpdatedAt > externalUpdatedAt && existingTask.syncStatus === 'synced') {
        // Local is newer and was synced, need to push our changes back
        return { taskId: existingTask.id, externalId: externalTask.id, action: 'skipped' };
      }

      // Update local task with external changes
      await db
        .update(tasks)
        .set({
          title: externalTask.title,
          description: externalTask.description,
          status: externalTask.status,
          priority: externalTask.priority,
          labels: externalTask.labels.length > 0 ? JSON.stringify(externalTask.labels) : null,
          assignee: externalTask.assignee,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          closedAt: externalTask.closedAt,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, existingTask.id));

      await this.logActivity(existingTask.id, 'updated', 'sync', provider, {
        externalId: externalTask.id,
      });

      return { taskId: existingTask.id, externalId: externalTask.id, action: 'updated' };
    }

    // Create new local task
    const newTask: NewTask = {
      applicationId,
      title: externalTask.title,
      description: externalTask.description,
      status: externalTask.status,
      priority: externalTask.priority,
      labels: externalTask.labels.length > 0 ? JSON.stringify(externalTask.labels) : null,
      assignee: externalTask.assignee,
      dueDate: null,
      sourceProvider: provider,
      sourceId: externalTask.id,
      syncStatus: 'synced',
      lastSyncAt: new Date(),
      closedAt: externalTask.closedAt,
    };

    // Set the appropriate external link
    this.setExternalLinkOnNewTask(newTask, provider, externalTask);

    const [createdTask] = await db.insert(tasks).values(newTask).returning();

    await this.logActivity(createdTask.id, 'created', 'sync', provider, {
      externalId: externalTask.id,
    });

    return { taskId: createdTask.id, externalId: externalTask.id, action: 'created' };
  }

  private async findTaskByExternalId(
    applicationId: string,
    provider: SyncProvider,
    externalId: string
  ): Promise<Task | null> {
    // Search based on the provider-specific link field
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.applicationId, applicationId));

    for (const task of allTasks) {
      const link = this.getExternalLink(task, provider);
      if (link && link.id === externalId) {
        return task;
      }
      // Also check sourceId for tasks created from external
      if (task.sourceProvider === provider && task.sourceId === externalId) {
        return task;
      }
    }

    return null;
  }

  private getExternalLink(
    task: Task,
    provider: SyncProvider
  ): { id: string; url: string } | null {
    let linkJson: string | null = null;

    switch (provider) {
      case 'github':
        linkJson = task.githubLink;
        break;
      case 'gitea':
        linkJson = task.giteaLink;
        break;
      case 'linear':
        linkJson = task.linearLink;
        break;
      case 'notion':
        linkJson = task.notionLink;
        break;
    }

    if (!linkJson) return null;

    try {
      const link = JSON.parse(linkJson);
      // Normalize the ID field (different providers use different field names)
      const id = link.number?.toString() || link.id || link.pageId;
      return { id, url: link.url };
    } catch {
      return null;
    }
  }

  private async saveExternalLink(
    taskId: string,
    provider: SyncProvider,
    externalTask: ExternalTaskData
  ): Promise<void> {
    const linkData = {
      id: externalTask.id,
      number: externalTask.number,
      url: externalTask.url,
    };

    const updateData: Record<string, string> = {};

    switch (provider) {
      case 'github':
        updateData.githubLink = JSON.stringify(linkData);
        break;
      case 'gitea':
        updateData.giteaLink = JSON.stringify(linkData);
        break;
      case 'linear':
        updateData.linearLink = JSON.stringify(linkData);
        break;
      case 'notion':
        updateData.notionLink = JSON.stringify({ pageId: externalTask.id, url: externalTask.url });
        break;
    }

    await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));
  }

  private setExternalLinkOnNewTask(
    task: NewTask,
    provider: SyncProvider,
    externalTask: ExternalTaskData
  ): void {
    const linkData = {
      id: externalTask.id,
      number: externalTask.number,
      url: externalTask.url,
    };

    switch (provider) {
      case 'github':
        task.githubLink = JSON.stringify(linkData);
        break;
      case 'gitea':
        task.giteaLink = JSON.stringify(linkData);
        break;
      case 'linear':
        task.linearLink = JSON.stringify(linkData);
        break;
      case 'notion':
        task.notionLink = JSON.stringify({ pageId: externalTask.id, url: externalTask.url });
        break;
    }
  }

  private async updateTaskSyncStatus(
    taskId: string,
    status: 'synced' | 'pending_push' | 'conflict',
    error?: string
  ): Promise<void> {
    await db
      .update(tasks)
      .set({
        syncStatus: status,
        syncError: error || null,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  }

  private async logActivity(
    taskId: string,
    action: string,
    actorType: string,
    source: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await db.insert(taskActivityLog).values({
      taskId,
      action,
      actorType,
      source,
      newValue: details ? JSON.stringify(details) : null,
    });
  }
}

// Export singleton instance
export const taskSyncEngine = new TaskSyncEngine();

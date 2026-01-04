/**
 * Gitea Sync Provider Adapter
 * 
 * Syncs tasks (issues) and releases with Gitea repositories.
 */

import { GiteaClient, type GiteaIssue, type GiteaRelease } from '../../gitea/client';
import {
  SyncProviderAdapter,
  type ProviderAdapterConfig,
  type BatchSyncResult,
  type SyncItemResult,
} from './base';
import type {
  ExternalTaskData,
  ExternalReleaseData,
  TaskCreateInput,
  TaskUpdateInput,
  ReleaseCreateInput,
  TaskStatus,
  GiteaProviderConfig,
} from '../types';

/**
 * Gitea-specific adapter configuration
 */
export interface GiteaAdapterConfig extends ProviderAdapterConfig {
  config: GiteaProviderConfig & {
    baseUrl: string;
    token?: string;
  };
}

export class GiteaSyncAdapter extends SyncProviderAdapter {
  private client: GiteaClient;
  private owner: string;
  private repo: string;

  constructor(config: GiteaAdapterConfig) {
    super(config);
    this.client = new GiteaClient({
      baseUrl: config.config.baseUrl,
      token: config.config.token || process.env.GITEA_TOKEN,
    });
    this.owner = config.config.owner;
    this.repo = config.config.repo;
  }

  // ===================================
  // Task Operations
  // ===================================

  async pullTasks(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalTaskData>> {
    try {
      const page = options?.cursor ? parseInt(options.cursor, 10) : 1;
      const limit = options?.limit || 30;

      const issues = await this.client.listIssues(this.owner, this.repo, {
        state: 'all',
        limit,
        page,
      });

      const items = issues.map((issue) => this.mapIssueToTask(issue));

      return {
        items,
        errors: [],
        hasMore: issues.length === limit,
        cursor: issues.length === limit ? String(page + 1) : undefined,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull tasks from Gitea' }],
        hasMore: false,
      };
    }
  }

  async pullTask(externalId: string): Promise<ExternalTaskData | null> {
    try {
      const issueNumber = parseInt(externalId, 10);
      const issue = await this.client.getIssue(this.owner, this.repo, issueNumber);
      return issue ? this.mapIssueToTask(issue) : null;
    } catch {
      return null;
    }
  }

  async pushTask(task: TaskCreateInput): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      // Gitea requires label IDs, so we need to get or create labels first
      const labelIds = await this.resolveLabelIds(task.labels || []);

      const issue = await this.client.createIssue(this.owner, this.repo, {
        title: task.title,
        body: task.description,
        labels: labelIds,
        assignees: task.assignee ? [task.assignee] : undefined,
        due_date: task.dueDate?.toISOString(),
      });

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create issue on Gitea',
      };
    }
  }

  async updateTask(
    externalId: string,
    task: TaskUpdateInput
  ): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const issueNumber = parseInt(externalId, 10);

      const updateInput: {
        title?: string;
        body?: string;
        labels?: number[];
        assignees?: string[];
        state?: 'open' | 'closed';
        due_date?: string;
      } = {};

      if (task.title) updateInput.title = task.title;
      if (task.description !== undefined) updateInput.body = task.description;
      if (task.labels) {
        updateInput.labels = await this.resolveLabelIds(task.labels);
      }
      if (task.assignee !== undefined) {
        updateInput.assignees = task.assignee ? [task.assignee] : [];
      }
      if (task.dueDate !== undefined) {
        updateInput.due_date = task.dueDate?.toISOString();
      }

      // Handle status changes
      if (task.status) {
        updateInput.state = this.mapToProviderStatus(task.status) as 'open' | 'closed';
      }

      const issue = await this.client.updateIssue(
        this.owner,
        this.repo,
        issueNumber,
        updateInput
      );

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update issue on Gitea',
      };
    }
  }

  async deleteTask(externalId: string): Promise<SyncItemResult<void>> {
    // Gitea doesn't support deleting issues, so we close them instead
    const result = await this.closeTask(externalId);
    return {
      success: result.success,
      error: result.error,
    };
  }

  async closeTask(externalId: string): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const issueNumber = parseInt(externalId, 10);
      const issue = await this.client.closeIssue(this.owner, this.repo, issueNumber);

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close issue on Gitea',
      };
    }
  }

  // ===================================
  // Release Operations
  // ===================================

  override supportsReleases(): boolean {
    return true;
  }

  override async pullReleases(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalReleaseData>> {
    try {
      const page = options?.cursor ? parseInt(options.cursor, 10) : 1;
      const limit = options?.limit || 30;

      const releases = await this.client.listReleases(this.owner, this.repo, {
        limit,
        page,
      });

      const items = releases.map((release) => this.mapReleaseToExternal(release));

      return {
        items,
        errors: [],
        hasMore: releases.length === limit,
        cursor: releases.length === limit ? String(page + 1) : undefined,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull releases from Gitea' }],
        hasMore: false,
      };
    }
  }

  override async pullRelease(externalIdOrTag: string): Promise<ExternalReleaseData | null> {
    try {
      // Try by tag first
      let release = await this.client.getReleaseByTag(this.owner, this.repo, externalIdOrTag);

      // If not found, try by ID
      if (!release) {
        const releaseId = parseInt(externalIdOrTag, 10);
        if (!isNaN(releaseId)) {
          release = await this.client.getRelease(this.owner, this.repo, releaseId);
        }
      }

      return release ? this.mapReleaseToExternal(release) : null;
    } catch {
      return null;
    }
  }

  override async pushRelease(release: ReleaseCreateInput): Promise<SyncItemResult<ExternalReleaseData>> {
    try {
      const giteaRelease = await this.client.createRelease(this.owner, this.repo, {
        tag_name: release.tagName,
        name: release.name,
        body: release.body,
        draft: release.draft,
        prerelease: release.prerelease,
        target_commitish: release.targetCommitish,
      });

      return {
        success: true,
        data: this.mapReleaseToExternal(giteaRelease),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create release on Gitea',
      };
    }
  }

  override async updateRelease(
    externalId: string,
    release: Partial<ReleaseCreateInput>
  ): Promise<SyncItemResult<ExternalReleaseData>> {
    try {
      const releaseId = parseInt(externalId, 10);

      const giteaRelease = await this.client.updateRelease(this.owner, this.repo, releaseId, {
        tag_name: release.tagName,
        name: release.name,
        body: release.body,
        draft: release.draft,
        prerelease: release.prerelease,
        target_commitish: release.targetCommitish,
      });

      return {
        success: true,
        data: this.mapReleaseToExternal(giteaRelease),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update release on Gitea',
      };
    }
  }

  override async deleteRelease(externalId: string): Promise<SyncItemResult<void>> {
    try {
      const releaseId = parseInt(externalId, 10);
      await this.client.deleteRelease(this.owner, this.repo, releaseId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete release on Gitea',
      };
    }
  }

  // ===================================
  // Health Check
  // ===================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getRepository(this.owner, this.repo);
      return true;
    } catch {
      return false;
    }
  }

  // ===================================
  // Helper Methods
  // ===================================

  private async resolveLabelIds(labelNames: string[]): Promise<number[]> {
    if (labelNames.length === 0) return [];

    try {
      const existingLabels = await this.client.listLabels(this.owner, this.repo);
      const labelIds: number[] = [];

      for (const name of labelNames) {
        const existing = existingLabels.find(
          (l) => l.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          labelIds.push(existing.id);
        } else {
          // Create the label if it doesn't exist
          const newLabel = await this.client.createLabel(this.owner, this.repo, {
            name,
            color: this.generateLabelColor(),
          });
          labelIds.push(newLabel.id);
        }
      }

      return labelIds;
    } catch {
      // If we can't resolve labels, return empty array
      return [];
    }
  }

  private generateLabelColor(): string {
    // Generate a random pastel color
    const hue = Math.floor(Math.random() * 360);
    const saturation = 40 + Math.floor(Math.random() * 20);
    const lightness = 70 + Math.floor(Math.random() * 15);
    return this.hslToHex(hue, saturation, lightness);
  }

  private hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `${f(0)}${f(8)}${f(4)}`;
  }

  // ===================================
  // Mapping Helpers
  // ===================================

  private mapIssueToTask(issue: GiteaIssue): ExternalTaskData {
    return {
      id: String(issue.number),
      number: issue.number,
      title: issue.title,
      description: issue.body || undefined,
      status: this.mapToUnifiedStatus(issue.state),
      priority: undefined, // Gitea issues don't have built-in priority
      assignee: issue.assignee?.login,
      labels: issue.labels.map((label) => label.name),
      url: issue.html_url,
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
    };
  }

  private mapReleaseToExternal(release: GiteaRelease): ExternalReleaseData {
    return {
      id: String(release.id),
      tagName: release.tag_name,
      name: release.name || undefined,
      body: release.body || undefined,
      draft: release.draft,
      prerelease: release.prerelease,
      url: release.html_url,
      createdAt: new Date(release.created_at),
      publishedAt: release.published_at ? new Date(release.published_at) : undefined,
    };
  }

  protected mapToUnifiedStatus(providerStatus: string): TaskStatus {
    switch (providerStatus) {
      case 'closed':
        return 'done';
      case 'open':
      default:
        return 'todo';
    }
  }

  protected mapToProviderStatus(status: TaskStatus): string {
    switch (status) {
      case 'done':
      case 'cancelled':
        return 'closed';
      case 'backlog':
      case 'todo':
      case 'in_progress':
      case 'in_review':
      default:
        return 'open';
    }
  }

  /**
   * Get the external link data for storing in the task record
   */
  getExternalLinkData(issue: ExternalTaskData): {
    owner: string;
    repo: string;
    number: number;
    url: string;
  } {
    return {
      owner: this.owner,
      repo: this.repo,
      number: issue.number || parseInt(issue.id, 10),
      url: issue.url,
    };
  }
}

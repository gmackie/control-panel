/**
 * GitHub Sync Provider Adapter
 * 
 * Syncs tasks (issues) and releases with GitHub repositories.
 */

import { GitHubClient, type GitHubIssue, type GitHubRelease } from '../../github/client';
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
  GithubProviderConfig,
} from '../types';

/**
 * GitHub-specific adapter configuration
 */
export interface GitHubAdapterConfig extends ProviderAdapterConfig {
  config: GithubProviderConfig;
}

export class GitHubSyncAdapter extends SyncProviderAdapter {
  private client: GitHubClient;
  private owner: string;
  private repo: string;

  constructor(config: GitHubAdapterConfig) {
    super(config);
    this.client = new GitHubClient();
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
      const perPage = options?.limit || 30;

      const issues = await this.client.listIssues(this.owner, this.repo, {
        state: 'all',
        per_page: perPage,
        page,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter out pull requests (they have a pull_request property)
      const filteredIssues = issues.filter(
        (issue) => !(issue as unknown as { pull_request?: unknown }).pull_request
      );

      const items = filteredIssues.map((issue) => this.mapIssueToTask(issue));

      return {
        items,
        errors: [],
        hasMore: issues.length === perPage,
        cursor: issues.length === perPage ? String(page + 1) : undefined,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull tasks from GitHub' }],
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
      const issue = await this.client.createIssue(this.owner, this.repo, {
        title: task.title,
        body: task.description,
        labels: task.labels,
        assignees: task.assignee ? [task.assignee] : undefined,
      });

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create issue on GitHub',
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
        labels?: string[];
        assignees?: string[];
        state?: 'open' | 'closed';
        state_reason?: 'completed' | 'not_planned' | 'reopened';
      } = {};

      if (task.title) updateInput.title = task.title;
      if (task.description !== undefined) updateInput.body = task.description;
      if (task.labels) updateInput.labels = task.labels;
      if (task.assignee !== undefined) {
        updateInput.assignees = task.assignee ? [task.assignee] : [];
      }

      // Handle status changes
      if (task.status) {
        const { state, stateReason } = this.mapStatusToGitHub(task.status);
        updateInput.state = state;
        if (stateReason) updateInput.state_reason = stateReason;
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
        error: error instanceof Error ? error.message : 'Failed to update issue on GitHub',
      };
    }
  }

  async deleteTask(externalId: string): Promise<SyncItemResult<void>> {
    // GitHub doesn't support deleting issues, so we close them instead
    const result = await this.closeTask(externalId);
    return {
      success: result.success,
      error: result.error,
    };
  }

  async closeTask(externalId: string): Promise<SyncItemResult<ExternalTaskData>> {
    try {
      const issueNumber = parseInt(externalId, 10);
      const issue = await this.client.closeIssue(
        this.owner,
        this.repo,
        issueNumber,
        'completed'
      );

      return {
        success: true,
        data: this.mapIssueToTask(issue),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close issue on GitHub',
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
      const perPage = options?.limit || 30;

      const releases = await this.client.listReleases(this.owner, this.repo, {
        per_page: perPage,
        page,
      });

      const items = releases.map((release) => this.mapReleaseToExternal(release));

      return {
        items,
        errors: [],
        hasMore: releases.length === perPage,
        cursor: releases.length === perPage ? String(page + 1) : undefined,
      };
    } catch (error) {
      return {
        items: [],
        errors: [{ message: error instanceof Error ? error.message : 'Failed to pull releases from GitHub' }],
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
      const githubRelease = await this.client.createRelease(this.owner, this.repo, {
        tag_name: release.tagName,
        name: release.name,
        body: release.body,
        draft: release.draft,
        prerelease: release.prerelease,
        target_commitish: release.targetCommitish,
      });

      return {
        success: true,
        data: this.mapReleaseToExternal(githubRelease),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create release on GitHub',
      };
    }
  }

  override async updateRelease(
    externalId: string,
    release: Partial<ReleaseCreateInput>
  ): Promise<SyncItemResult<ExternalReleaseData>> {
    try {
      const releaseId = parseInt(externalId, 10);

      const githubRelease = await this.client.updateRelease(this.owner, this.repo, releaseId, {
        tag_name: release.tagName,
        name: release.name,
        body: release.body,
        draft: release.draft,
        prerelease: release.prerelease,
        target_commitish: release.targetCommitish,
      });

      return {
        success: true,
        data: this.mapReleaseToExternal(githubRelease),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update release on GitHub',
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
        error: error instanceof Error ? error.message : 'Failed to delete release on GitHub',
      };
    }
  }

  // ===================================
  // Health Check
  // ===================================

  async healthCheck(): Promise<boolean> {
    try {
      const repo = await this.client.getRepo(this.owner, this.repo);
      return repo !== null;
    } catch {
      return false;
    }
  }

  // ===================================
  // Mapping Helpers
  // ===================================

  private mapIssueToTask(issue: GitHubIssue): ExternalTaskData {
    return {
      id: String(issue.number),
      number: issue.number,
      title: issue.title,
      description: issue.body || undefined,
      status: this.mapToUnifiedStatus(issue.state),
      priority: undefined, // GitHub issues don't have built-in priority
      assignee: issue.assignee?.login,
      labels: issue.labels.map((label) => label.name),
      url: issue.html_url,
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
    };
  }

  private mapReleaseToExternal(release: GitHubRelease): ExternalReleaseData {
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
    // GitHub only has open/closed states
    // Map closed to 'done', open to 'todo'
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

  private mapStatusToGitHub(status: TaskStatus): {
    state: 'open' | 'closed';
    stateReason?: 'completed' | 'not_planned' | 'reopened';
  } {
    switch (status) {
      case 'done':
        return { state: 'closed', stateReason: 'completed' };
      case 'cancelled':
        return { state: 'closed', stateReason: 'not_planned' };
      case 'backlog':
      case 'todo':
      case 'in_progress':
      case 'in_review':
      default:
        return { state: 'open' };
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

import type { Actor, Timestamps, PaginationOptions, PaginatedResponse } from '../types';

export type GitProviderType = 'github' | 'gitea' | 'gitlab';

export interface Repository extends Timestamps {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  isFork: boolean;
  owner: Actor;
  language: string | null;
  starCount: number;
  forkCount: number;
  openIssuesCount: number;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface Commit {
  sha: string;
  message: string;
  author: Actor;
  committer: Actor;
  timestamp: Date;
  url: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
  active?: boolean;
}

export interface WorkflowRun {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | null;
  branch: string;
  commitSha: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Release {
  id: string;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  url: string;
  author: Actor;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
}

export interface CreateRepoFromTemplateOptions extends CreateRepoOptions {
  templateOwner: string;
  templateRepo: string;
  includeAllBranches?: boolean;
}

export interface CreateReleaseOptions {
  tagName: string;
  name: string;
  body: string;
  targetCommitish?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface ListReposOptions extends PaginationOptions {
  org?: string;
  type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
}

export interface ListCommitsOptions extends PaginationOptions {
  branch?: string;
  since?: Date;
  until?: Date;
  author?: string;
}

export interface ListWorkflowRunsOptions extends PaginationOptions {
  branch?: string;
  event?: string;
  status?: WorkflowRun['status'];
}

export type ListReposResponse = PaginatedResponse<Repository>;
export type ListCommitsResponse = PaginatedResponse<Commit>;
export type ListWorkflowRunsResponse = PaginatedResponse<WorkflowRun>;

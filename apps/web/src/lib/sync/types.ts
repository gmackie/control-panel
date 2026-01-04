export type SyncProvider = 'github' | 'gitea' | 'linear' | 'notion';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type SyncStatus = 'local_only' | 'synced' | 'pending_push' | 'conflict' | 'externally_deleted';
export type SyncDirection = 'bidirectional' | 'push_only' | 'pull_only';

export interface ExternalTaskData {
  id: string;
  number?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  labels: string[];
  url: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface ExternalReleaseData {
  id: string;
  tagName: string;
  name?: string;
  body?: string;
  draft: boolean;
  prerelease: boolean;
  url: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface SyncResult {
  success: boolean;
  provider: SyncProvider;
  tasksCreated: number;
  tasksUpdated: number;
  tasksPushed: number;
  errors: SyncError[];
  timestamp: Date;
}

export interface SyncError {
  taskId?: string;
  externalId?: string;
  message: string;
  code: string;
}

export interface ProviderConfig {
  provider: SyncProvider;
  enabled: boolean;
  config: Record<string, unknown>;
  syncDirection: SyncDirection;
}

export interface GithubProviderConfig {
  owner: string;
  repo: string;
  [key: string]: unknown;
}

export interface GiteaProviderConfig {
  owner: string;
  repo: string;
  [key: string]: unknown;
}

export interface LinearProviderConfig {
  teamId: string;
  projectId?: string;
  [key: string]: unknown;
}

export interface NotionProviderConfig {
  databaseId: string;
  [key: string]: unknown;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  labels?: string[];
  dueDate?: Date;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  labels?: string[];
  dueDate?: Date;
}

export interface ReleaseCreateInput {
  tagName: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  targetCommitish?: string;
}

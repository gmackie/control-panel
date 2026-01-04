/**
 * Webhook Types for GitHub, Gitea, and Linear
 * 
 * Type definitions for incoming webhook events from external providers.
 * Used by webhook handlers to sync tasks and releases in real-time.
 */

// ===================================
// Common Types
// ===================================

export interface WebhookResult {
  success: boolean;
  processed: boolean;
  tasksCreated: number;
  tasksUpdated: number;
  releasesCreated: number;
  releasesUpdated: number;
  error?: string;
}

export type WebhookEventType = 
  | 'issues' 
  | 'issue_comment'
  | 'release'
  | 'push'
  | 'pull_request';

// ===================================
// GitHub Webhook Types
// ===================================

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: GitHubUser;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  labels: GitHubLabel[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  html_url: string;
  default_branch: string;
}

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  content_type: string;
  size: number;
  download_count: number;
  browser_download_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  author: GitHubUser;
  assets: GitHubReleaseAsset[];
  target_commitish: string;
  created_at: string;
  published_at: string | null;
}

// GitHub webhook event payloads
export interface GitHubIssuesEvent {
  action: 'opened' | 'edited' | 'deleted' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'labeled' | 'unlabeled' | 'transferred';
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: GitHubUser;
  label?: GitHubLabel; // Present for labeled/unlabeled events
  assignee?: GitHubUser; // Present for assigned/unassigned events
}

export interface GitHubIssueCommentEvent {
  action: 'created' | 'edited' | 'deleted';
  issue: GitHubIssue;
  comment: {
    id: number;
    body: string;
    user: GitHubUser;
    html_url: string;
    created_at: string;
    updated_at: string;
  };
  repository: GitHubRepository;
  sender: GitHubUser;
}

export interface GitHubReleaseEvent {
  action: 'published' | 'unpublished' | 'created' | 'edited' | 'deleted' | 'prereleased' | 'released';
  release: GitHubRelease;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export type GitHubWebhookPayload = 
  | GitHubIssuesEvent 
  | GitHubIssueCommentEvent 
  | GitHubReleaseEvent;

// ===================================
// Gitea Webhook Types
// ===================================

export interface GiteaUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
  avatar_url: string;
  username: string;
}

export interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  user: GiteaUser;
  assignee: GiteaUser | null;
  assignees: GiteaUser[] | null;
  labels: GiteaLabel[] | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GiteaUser;
  html_url: string;
  default_branch: string;
}

export interface GiteaReleaseAsset {
  id: number;
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
}

export interface GiteaRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  author: GiteaUser;
  assets: GiteaReleaseAsset[];
  target_commitish: string;
  created_at: string;
  published_at: string;
}

// Gitea webhook event payloads
export interface GiteaIssuesEvent {
  action: 'opened' | 'edited' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'label_updated' | 'label_cleared' | 'deleted';
  issue: GiteaIssue;
  repository: GiteaRepository;
  sender: GiteaUser;
}

export interface GiteaIssueCommentEvent {
  action: 'created' | 'edited' | 'deleted';
  issue: GiteaIssue;
  comment: {
    id: number;
    body: string;
    user: GiteaUser;
    html_url: string;
    created_at: string;
    updated_at: string;
  };
  repository: GiteaRepository;
  sender: GiteaUser;
}

export interface GiteaReleaseEvent {
  action: 'published' | 'updated' | 'deleted';
  release: GiteaRelease;
  repository: GiteaRepository;
  sender: GiteaUser;
}

export type GiteaWebhookPayload = 
  | GiteaIssuesEvent 
  | GiteaIssueCommentEvent 
  | GiteaReleaseEvent;

// ===================================
// Linear Webhook Types
// ===================================

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface LinearProject {
  id: string;
  name: string;
  slugId: string;
}

export interface LinearState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "ENG-123"
  title: string;
  description?: string;
  priority: number; // 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  state: LinearState;
  assignee?: LinearUser;
  labels: LinearLabel[];
  team: LinearTeam;
  project?: LinearProject;
  url: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  canceledAt?: string;
}

export interface LinearComment {
  id: string;
  body: string;
  user: LinearUser;
  issue: { id: string };
  createdAt: string;
  updatedAt: string;
}

// Linear webhook event payloads
export interface LinearIssueEvent {
  action: 'create' | 'update' | 'remove';
  type: 'Issue';
  createdAt: string;
  data: LinearIssue;
  updatedFrom?: Partial<LinearIssue>; // Previous values for updated fields
}

export interface LinearCommentEvent {
  action: 'create' | 'update' | 'remove';
  type: 'Comment';
  createdAt: string;
  data: LinearComment;
}

export interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove';
  type: 'Issue' | 'Comment' | 'Project' | 'Cycle' | 'IssueLabel';
  createdAt: string;
  data: Record<string, unknown>;
  updatedFrom?: Record<string, unknown>;
  url?: string;
  organizationId: string;
  webhookId: string;
  webhookTimestamp: number;
}

// ===================================
// Type Guards
// ===================================

export function isGitHubIssuesEvent(payload: GitHubWebhookPayload): payload is GitHubIssuesEvent {
  return 'issue' in payload && !('comment' in payload) && !('release' in payload);
}

export function isGitHubIssueCommentEvent(payload: GitHubWebhookPayload): payload is GitHubIssueCommentEvent {
  return 'issue' in payload && 'comment' in payload;
}

export function isGitHubReleaseEvent(payload: GitHubWebhookPayload): payload is GitHubReleaseEvent {
  return 'release' in payload;
}

export function isGiteaIssuesEvent(payload: GiteaWebhookPayload): payload is GiteaIssuesEvent {
  return 'issue' in payload && !('comment' in payload) && !('release' in payload);
}

export function isGiteaIssueCommentEvent(payload: GiteaWebhookPayload): payload is GiteaIssueCommentEvent {
  return 'issue' in payload && 'comment' in payload;
}

export function isGiteaReleaseEvent(payload: GiteaWebhookPayload): payload is GiteaReleaseEvent {
  return 'release' in payload;
}

export function isLinearIssueEvent(payload: LinearWebhookPayload): payload is LinearWebhookPayload & { data: LinearIssue } {
  return payload.type === 'Issue';
}

export function isLinearCommentEvent(payload: LinearWebhookPayload): payload is LinearWebhookPayload & { data: LinearComment } {
  return payload.type === 'Comment';
}

// ===================================
// Status Mapping Helpers
// ===================================

import type { TaskStatus, TaskPriority } from '@/lib/sync/types';

/**
 * Map GitHub/Gitea issue state to our task status
 */
export function mapIssueStateToStatus(state: 'open' | 'closed'): TaskStatus {
  return state === 'closed' ? 'done' : 'todo';
}

/**
 * Map Linear state type to our task status
 */
export function mapLinearStateToStatus(stateType: LinearState['type']): TaskStatus {
  switch (stateType) {
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

/**
 * Map Linear priority number to our priority
 */
export function mapLinearPriorityToPriority(priority: number): TaskPriority | undefined {
  switch (priority) {
    case 1:
      return 'urgent';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    case 4:
      return 'low';
    default:
      return undefined; // No priority (0)
  }
}

/**
 * Map GitHub/Gitea labels to priority (looks for priority-related labels)
 */
export function mapLabelsToFriority(labels: Array<{ name: string }>): TaskPriority | undefined {
  const priorityLabels = labels.map(l => l.name.toLowerCase());
  
  if (priorityLabels.some(l => l.includes('urgent') || l.includes('critical') || l.includes('p0'))) {
    return 'urgent';
  }
  if (priorityLabels.some(l => l.includes('high') || l.includes('p1'))) {
    return 'high';
  }
  if (priorityLabels.some(l => l.includes('medium') || l.includes('p2'))) {
    return 'medium';
  }
  if (priorityLabels.some(l => l.includes('low') || l.includes('p3') || l.includes('p4'))) {
    return 'low';
  }
  
  return undefined;
}

/**
 * GitHub Service
 * High-level service for interacting with GitHub API
 * Mirrors the Gitea service structure for consistency
 */

import { GitHubClient, GitHubRepo, GitHubUser, CrossPublishedRepo } from './client';

export interface GitHubConfig {
  token: string;
  username?: string;
  organization?: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  created_at: string;
  updated_at: string;
  run_number: number;
  event: string;
  html_url: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  repository: {
    name: string;
    full_name: string;
  };
}

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled_manually' | 'disabled_inactivity';
  created_at: string;
  updated_at: string;
  html_url: string;
}

export class GitHubService {
  private client: GitHubClient;
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.config = {
      token: process.env.GITHUB_TOKEN || '',
      username: process.env.GITHUB_USERNAME || 'gmackie',
      organization: process.env.GITHUB_ORG,
    };

    this.client = new GitHubClient({
      token: this.config.token,
      username: this.config.username,
    });
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GMAC-Control-Panel',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get repositories for the configured user
   */
  async getRepositories(username?: string): Promise<GitHubRepo[]> {
    return this.client.getUserRepos(username || this.config.username);
  }

  /**
   * Get a specific repository
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo | null> {
    return this.client.getRepo(owner, repo);
  }

  /**
   * Get commits for a repository
   */
  async getCommits(owner: string, repo: string, options?: { 
    sha?: string; 
    limit?: number;
    since?: string;
  }): Promise<GitHubCommit[]> {
    try {
      const params = new URLSearchParams();
      if (options?.sha) params.append('sha', options.sha);
      if (options?.limit) params.append('per_page', options.limit.toString());
      if (options?.since) params.append('since', options.since);
      
      return await this.request<GitHubCommit[]>(
        `/repos/${owner}/${repo}/commits?${params}`
      );
    } catch (error) {
      console.error('Error fetching GitHub commits:', error);
      return [];
    }
  }

  /**
   * Get branches for a repository
   */
  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    try {
      return await this.request<GitHubBranch[]>(
        `/repos/${owner}/${repo}/branches`
      );
    } catch (error) {
      console.error('Error fetching GitHub branches:', error);
      return [];
    }
  }

  /**
   * Get workflows for a repository
   */
  async getWorkflows(owner: string, repo: string): Promise<GitHubWorkflow[]> {
    try {
      const response = await this.request<{ workflows: GitHubWorkflow[] }>(
        `/repos/${owner}/${repo}/actions/workflows`
      );
      return response.workflows || [];
    } catch (error) {
      console.error('Error fetching GitHub workflows:', error);
      return [];
    }
  }

  /**
   * Get workflow runs for a repository
   */
  async getWorkflowRuns(owner: string, repo: string, options?: {
    workflow_id?: number;
    status?: string;
    limit?: number;
  }): Promise<GitHubWorkflowRun[]> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('per_page', options.limit.toString());
      
      const path = options?.workflow_id
        ? `/repos/${owner}/${repo}/actions/workflows/${options.workflow_id}/runs?${params}`
        : `/repos/${owner}/${repo}/actions/runs?${params}`;
      
      const response = await this.request<{ workflow_runs: GitHubWorkflowRun[] }>(path);
      return response.workflow_runs || [];
    } catch (error) {
      console.error('Error fetching GitHub workflow runs:', error);
      return [];
    }
  }

  /**
   * Trigger a workflow dispatch
   */
  async triggerWorkflow(
    owner: string,
    repo: string,
    workflowId: string | number,
    ref: string = 'main',
    inputs?: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(
        `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
        {
          method: 'POST',
          body: JSON.stringify({ ref, inputs: inputs || {} }),
        }
      );
      return { success: true };
    } catch (error) {
      console.error('Error triggering GitHub workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Find repos that exist on both GitHub and Gitea
   */
  async findCrossPublishedRepos(giteaRepos: Array<{
    name: string;
    full_name: string;
    html_url: string;
    updated_at?: string;
  }>): Promise<CrossPublishedRepo[]> {
    return this.client.findCrossPublishedRepos(giteaRepos);
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    return this.client.getCurrentUser();
  }

  /**
   * Get API rate limit status
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    return this.client.getRateLimit();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const rateLimit = await this.getRateLimit();
      return rateLimit.remaining > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get repository statistics
   */
  async getRepoStats(): Promise<{
    totalRepos: number;
    publicRepos: number;
    privateRepos: number;
    totalStars: number;
    totalForks: number;
    languages: Record<string, number>;
  }> {
    try {
      const repos = await this.getRepositories();
      
      const stats = {
        totalRepos: repos.length,
        publicRepos: repos.filter(r => !r.private).length,
        privateRepos: repos.filter(r => r.private).length,
        totalStars: repos.reduce((sum, r) => sum + r.stargazers_count, 0),
        totalForks: repos.reduce((sum, r) => sum + r.forks_count, 0),
        languages: {} as Record<string, number>,
      };

      // Count languages
      repos.forEach(repo => {
        if (repo.language) {
          stats.languages[repo.language] = (stats.languages[repo.language] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting GitHub repo stats:', error);
      return {
        totalRepos: 0,
        publicRepos: 0,
        privateRepos: 0,
        totalStars: 0,
        totalForks: 0,
        languages: {},
      };
    }
  }
}

// Export singleton instance
export const githubService = new GitHubService();

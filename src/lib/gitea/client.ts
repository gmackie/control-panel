export interface GiteaRepository {
  id: number;
  owner: {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
  };
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  fork: boolean;
  template: boolean;
  parent: any;
  mirror: boolean;
  size: number;
  language: string;
  languages_url: string;
  html_url: string;
  ssh_url: string;
  clone_url: string;
  original_url: string;
  website: string;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  open_pr_counter: number;
  release_counter: number;
  default_branch: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  has_issues: boolean;
  internal_tracker: {
    enable_time_tracker: boolean;
    allow_only_contributors_to_track_time: boolean;
    enable_issue_dependencies: boolean;
  };
  has_wiki: boolean;
  has_pull_requests: boolean;
  has_projects: boolean;
  ignore_whitespace_conflicts: boolean;
  allow_merge_commits: boolean;
  allow_rebase: boolean;
  allow_rebase_explicit: boolean;
  allow_squash_merge: boolean;
  default_merge_style: string;
  avatar_url: string;
  internal: boolean;
  mirror_interval: string;
  mirror_updated: string;
  empty: boolean;
}

export interface GiteaWorkflowRun {
  id: number;
  run_number: number;
  workflow_id: string;
  workflow_name: string;
  head_branch: string;
  head_sha: string;
  event: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  workflow_url: string;
  html_url: string;
  pull_requests: any[];
  created_at: string;
  updated_at: string;
  actor: {
    id: number;
    login: string;
    avatar_url: string;
  };
  run_attempt: number;
  referenced_workflows: any[];
  run_started_at: string;
  triggering_actor: {
    id: number;
    login: string;
    avatar_url: string;
  };
  jobs_url: string;
  logs_url: string;
  check_suite_url: string;
  artifacts_url: string;
  cancel_url: string;
  rerun_url: string;
  previous_attempt_url: string | null;
  workflow_url: string;
  commit: {
    id: string;
    tree_id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
    committer: {
      name: string;
      email: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
}

export interface GiteaSecret {
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GiteaWebhook {
  id: number;
  type: string;
  url: string;
  config: {
    content_type: string;
    url: string;
    secret?: string;
  };
  events: string[];
  active: boolean;
  updated_at: string;
  created_at: string;
}

export interface GiteaBranch {
  name: string;
  commit: {
    id: string;
    message: string;
    url: string;
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
    timestamp: string;
  };
  protected: boolean;
  required_approvals: number;
  enable_status_check: boolean;
  status_check_contexts: string[];
}

export interface GiteaPullRequest {
  id: number;
  url: string;
  number: number;
  user: {
    id: number;
    login: string;
    full_name: string;
    email: string;
    avatar_url: string;
  };
  title: string;
  body: string;
  labels: any[];
  milestone: any;
  assignee: any;
  assignees: any[];
  state: 'open' | 'closed';
  is_locked: boolean;
  comments: number;
  html_url: string;
  diff_url: string;
  patch_url: string;
  mergeable: boolean;
  merged: boolean;
  merged_at: string | null;
  merge_commit_sha: string | null;
  merged_by: any;
  base: {
    label: string;
    ref: string;
    sha: string;
    repo_id: number;
    repo: GiteaRepository;
  };
  head: {
    label: string;
    ref: string;
    sha: string;
    repo_id: number;
    repo: GiteaRepository;
  };
  merge_base: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GiteaClientConfig {
  baseUrl: string;
  token?: string;
  username?: string;
  password?: string;
}

export class GiteaClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: GiteaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };

    if (config.token) {
      this.headers['Authorization'] = `token ${config.token}`;
    } else if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      this.headers['Authorization'] = `Basic ${auth}`;
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gitea API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Repository methods
  async listRepositories(options?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<GiteaRepository[]> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.sort) params.append('sort', options.sort);
    if (options?.order) params.append('order', options.order);

    return this.request<GiteaRepository[]>(`/repos/search?${params}`);
  }

  async getRepository(owner: string, repo: string): Promise<GiteaRepository> {
    return this.request<GiteaRepository>(`/repos/${owner}/${repo}`);
  }

  async createRepository(data: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    gitignores?: string;
    license?: string;
    readme?: string;
    default_branch?: string;
  }): Promise<GiteaRepository> {
    return this.request<GiteaRepository>('/user/repos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Workflow/Actions methods
  async listWorkflowRuns(
    owner: string,
    repo: string,
    options?: {
      branch?: string;
      event?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ workflow_runs: GiteaWorkflowRun[] }> {
    const params = new URLSearchParams();
    if (options?.branch) params.append('branch', options.branch);
    if (options?.event) params.append('event', options.event);
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.request<{ workflow_runs: GiteaWorkflowRun[] }>(
      `/repos/${owner}/${repo}/actions/runs?${params}`
    );
  }

  async getWorkflowRuns(owner: string, repo: string): Promise<GiteaWorkflowRun[]> {
    try {
      const result = await this.listWorkflowRuns(owner, repo, { limit: 10 });
      return result.workflow_runs || [];
    } catch (error) {
      console.error('Error fetching workflow runs:', error);
      return [];
    }
  }

  async getCommits(owner: string, repo: string, options?: { sha?: string; limit?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.sha) params.append('sha', options.sha);
    if (options?.limit) params.append('limit', options.limit.toString());
    
    try {
      return await this.request<any[]>(`/repos/${owner}/${repo}/commits?${params}`);
    } catch (error) {
      console.error('Error fetching commits:', error);
      return [];
    }
  }

  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<GiteaWorkflowRun> {
    return this.request<GiteaWorkflowRun>(
      `/repos/${owner}/${repo}/actions/runs/${runId}`
    );
  }

  async rerunWorkflow(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`,
      { method: 'POST' }
    );
  }

  async cancelWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
      { method: 'POST' }
    );
  }

  // Secrets methods
  async listSecrets(owner: string, repo: string): Promise<GiteaSecret[]> {
    return this.request<GiteaSecret[]>(`/repos/${owner}/${repo}/actions/secrets`);
  }

  async createOrUpdateSecret(
    owner: string,
    repo: string,
    secretName: string,
    secretValue: string
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
      method: 'PUT',
      body: JSON.stringify({ data: secretValue }),
    });
  }

  async deleteSecret(
    owner: string,
    repo: string,
    secretName: string
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
      method: 'DELETE',
    });
  }

  // Webhook methods
  async listWebhooks(owner: string, repo: string): Promise<GiteaWebhook[]> {
    return this.request<GiteaWebhook[]>(`/repos/${owner}/${repo}/hooks`);
  }

  async createWebhook(
    owner: string,
    repo: string,
    webhook: {
      type: 'gitea' | 'gogs' | 'slack' | 'discord' | 'dingtalk' | 'telegram' | 'msteams' | 'feishu' | 'matrix' | 'wechatwork' | 'packagist';
      config: {
        url: string;
        content_type?: string;
        secret?: string;
      };
      events?: string[];
      branch_filter?: string;
      active?: boolean;
    }
  ): Promise<GiteaWebhook> {
    return this.request<GiteaWebhook>(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: JSON.stringify(webhook),
    });
  }

  async deleteWebhook(
    owner: string,
    repo: string,
    hookId: number
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'DELETE',
    });
  }

  // Branch methods
  async listBranches(owner: string, repo: string): Promise<GiteaBranch[]> {
    return this.request<GiteaBranch[]>(`/repos/${owner}/${repo}/branches`);
  }

  async getBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GiteaBranch> {
    return this.request<GiteaBranch>(`/repos/${owner}/${repo}/branches/${branch}`);
  }

  // Pull Request methods
  async listPullRequests(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'oldest' | 'recentupdate' | 'leastupdate' | 'mostcomment' | 'leastcomment' | 'priority';
      milestone?: number;
      labels?: string[];
      page?: number;
      limit?: number;
    }
  ): Promise<GiteaPullRequest[]> {
    const params = new URLSearchParams();
    if (options?.state) params.append('state', options.state);
    if (options?.sort) params.append('sort', options.sort);
    if (options?.milestone) params.append('milestone', options.milestone.toString());
    if (options?.labels) params.append('labels', options.labels.join(','));
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.request<GiteaPullRequest[]>(`/repos/${owner}/${repo}/pulls?${params}`);
  }

  async getPullRequest(
    owner: string,
    repo: string,
    index: number
  ): Promise<GiteaPullRequest> {
    return this.request<GiteaPullRequest>(`/repos/${owner}/${repo}/pulls/${index}`);
  }

  // User/Organization methods
  async getCurrentUser(): Promise<any> {
    return this.request('/user');
  }

  async listOrganizations(): Promise<any[]> {
    return this.request('/user/orgs');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/v1/version`);
      return true;
    } catch {
      return false;
    }
  }
}
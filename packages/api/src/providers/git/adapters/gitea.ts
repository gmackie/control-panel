import { createProviderError } from '../../types';
import type { GitProvider, GitProviderConfig } from '../index';
import type {
  Repository,
  Branch,
  Commit,
  Webhook,
  WebhookConfig,
  WorkflowRun,
  Release,
  CreateRepoOptions,
  CreateRepoFromTemplateOptions,
  CreateReleaseOptions,
  ListReposOptions,
  ListReposResponse,
  ListCommitsOptions,
  ListCommitsResponse,
  ListWorkflowRunsOptions,
  ListWorkflowRunsResponse,
} from '../types';

interface GiteaConfig extends GitProviderConfig {
  type: 'gitea';
  baseUrl: string;
  owner?: string;
}

export class GiteaProvider implements GitProvider {
  readonly type = 'gitea' as const;
  private baseUrl: string;
  private token: string;
  private defaultOwner?: string;

  constructor(config: GiteaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.defaultOwner = config.owner;
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `token ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      throw this.createApiError(response.status, error, path);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async listRepos(options?: ListReposOptions): Promise<ListReposResponse> {
    const perPage = options?.perPage ?? 30;
    const page = options?.page ?? 1;

    const params = new URLSearchParams();
    params.append('limit', perPage.toString());
    params.append('page', page.toString());

    let repos: GiteaRepository[];

    if (options?.org) {
      repos = await this.request<GiteaRepository[]>(`/orgs/${options.org}/repos?${params}`);
    } else {
      repos = await this.request<GiteaRepository[]>(`/user/repos?${params}`);
    }

    return {
      data: repos.map(this.mapRepository),
      pagination: {
        page,
        perPage,
        total: repos.length,
        totalPages: Math.ceil(repos.length / perPage),
        hasNextPage: repos.length === perPage,
        hasPrevPage: page > 1,
      },
    };
  }

  async getRepo(owner: string, name: string): Promise<Repository> {
    const repo = await this.request<GiteaRepository>(`/repos/${owner}/${name}`);
    return this.mapRepository(repo);
  }

  async createRepo(options: CreateRepoOptions): Promise<Repository> {
    const repo = await this.request<GiteaRepository>('/user/repos', {
      method: 'POST',
      body: {
        name: options.name,
        description: options.description,
        private: options.isPrivate ?? false,
        auto_init: options.autoInit ?? false,
        gitignores: options.gitignoreTemplate,
        license: options.licenseTemplate,
      },
    });
    return this.mapRepository(repo);
  }

  async createRepoFromTemplate(options: CreateRepoFromTemplateOptions): Promise<Repository> {
    const repo = await this.request<GiteaRepository>(
      `/repos/${options.templateOwner}/${options.templateRepo}/generate`,
      {
        method: 'POST',
        body: {
          owner: this.defaultOwner,
          name: options.name,
          description: options.description,
          private: options.isPrivate ?? false,
          git_content: true,
          topics: true,
          git_hooks: false,
          webhooks: false,
          avatar: false,
          labels: true,
        },
      }
    );
    return this.mapRepository(repo);
  }

  async deleteRepo(owner: string, name: string): Promise<void> {
    await this.request(`/repos/${owner}/${name}`, { method: 'DELETE' });
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    const branches = await this.request<GiteaBranch[]>(`/repos/${owner}/${repo}/branches`);
    return branches.map(this.mapBranch);
  }

  async getDefaultBranch(owner: string, repo: string): Promise<Branch> {
    const repoData = await this.request<GiteaRepository>(`/repos/${owner}/${repo}`);
    const branch = await this.request<GiteaBranch>(
      `/repos/${owner}/${repo}/branches/${repoData.default_branch}`
    );
    return this.mapBranch(branch);
  }

  async getCommits(
    owner: string,
    repo: string,
    options?: ListCommitsOptions
  ): Promise<ListCommitsResponse> {
    const perPage = options?.perPage ?? 30;
    const page = options?.page ?? 1;

    const params = new URLSearchParams();
    params.append('limit', perPage.toString());
    params.append('page', page.toString());
    if (options?.branch) params.append('sha', options.branch);

    const commits = await this.request<GiteaCommit[]>(`/repos/${owner}/${repo}/commits?${params}`);

    return {
      data: commits.map(this.mapCommit),
      pagination: {
        page,
        perPage,
        total: commits.length,
        totalPages: Math.ceil(commits.length / perPage),
        hasNextPage: commits.length === perPage,
        hasPrevPage: page > 1,
      },
    };
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<Commit> {
    const commit = await this.request<GiteaCommit>(`/repos/${owner}/${repo}/git/commits/${sha}`);
    return this.mapCommit(commit);
  }

  async getWebhooks(owner: string, repo: string): Promise<Webhook[]> {
    const hooks = await this.request<GiteaWebhook[]>(`/repos/${owner}/${repo}/hooks`);
    return hooks.map(this.mapWebhook);
  }

  async createWebhook(
    owner: string,
    repo: string,
    config: WebhookConfig
  ): Promise<Webhook> {
    const hook = await this.request<GiteaWebhook>(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: {
        type: 'gitea',
        config: {
          url: config.url,
          content_type: 'json',
          secret: config.secret,
        },
        events: config.events,
        active: config.active ?? true,
      },
    });
    return this.mapWebhook(hook);
  }

  async updateWebhook(
    owner: string,
    repo: string,
    webhookId: string,
    config: Partial<WebhookConfig>
  ): Promise<Webhook> {
    const hook = await this.request<GiteaWebhook>(`/repos/${owner}/${repo}/hooks/${webhookId}`, {
      method: 'PATCH',
      body: {
        config: config.url
          ? {
              url: config.url,
              content_type: 'json',
              secret: config.secret,
            }
          : undefined,
        events: config.events,
        active: config.active,
      },
    });
    return this.mapWebhook(hook);
  }

  async deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/hooks/${webhookId}`, { method: 'DELETE' });
  }

  async getWorkflowRuns(
    owner: string,
    repo: string,
    options?: ListWorkflowRunsOptions
  ): Promise<ListWorkflowRunsResponse> {
    const perPage = options?.perPage ?? 30;
    const page = options?.page ?? 1;

    const params = new URLSearchParams();
    params.append('limit', perPage.toString());
    params.append('page', page.toString());
    if (options?.branch) params.append('branch', options.branch);
    if (options?.status) params.append('status', options.status);

    const result = await this.request<{ workflow_runs: GiteaWorkflowRun[] }>(
      `/repos/${owner}/${repo}/actions/runs?${params}`
    );

    const runs = result.workflow_runs ?? [];

    return {
      data: runs.map(this.mapWorkflowRun),
      pagination: {
        page,
        perPage,
        total: runs.length,
        totalPages: Math.ceil(runs.length / perPage),
        hasNextPage: runs.length === perPage,
        hasPrevPage: page > 1,
      },
    };
  }

  async getReleases(owner: string, repo: string): Promise<Release[]> {
    const releases = await this.request<GiteaRelease[]>(`/repos/${owner}/${repo}/releases`);
    return releases.map(this.mapRelease);
  }

  async getLatestRelease(owner: string, repo: string): Promise<Release | null> {
    try {
      const releases = await this.request<GiteaRelease[]>(
        `/repos/${owner}/${repo}/releases?limit=1`
      );
      const first = releases[0];
      return first ? this.mapRelease(first) : null;
    } catch {
      return null;
    }
  }

  async createRelease(
    owner: string,
    repo: string,
    options: CreateReleaseOptions
  ): Promise<Release> {
    const release = await this.request<GiteaRelease>(`/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      body: {
        tag_name: options.tagName,
        name: options.name,
        body: options.body,
        target_commitish: options.targetCommitish,
        draft: options.draft ?? false,
        prerelease: options.prerelease ?? false,
      },
    });
    return this.mapRelease(release);
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    const params = ref ? `?ref=${ref}` : '';
    const file = await this.request<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}${params}`
    );

    if (file.encoding === 'base64') {
      return Buffer.from(file.content, 'base64').toString('utf-8');
    }
    return file.content;
  }

  private mapRepository = (repo: GiteaRepository): Repository => ({
    id: repo.id.toString(),
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || null,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
    sshUrl: repo.ssh_url,
    defaultBranch: repo.default_branch,
    isPrivate: repo.private,
    isFork: repo.fork,
    owner: {
      id: repo.owner.id.toString(),
      name: repo.owner.full_name || repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
    },
    language: repo.language || null,
    starCount: repo.stars_count,
    forkCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    createdAt: new Date(repo.created_at),
    updatedAt: new Date(repo.updated_at),
  });

  private mapBranch = (branch: GiteaBranch): Branch => ({
    name: branch.name,
    sha: branch.commit.id,
    protected: branch.protected,
  });

  private mapCommit = (commit: GiteaCommit): Commit => ({
    sha: commit.sha,
    message: commit.commit?.message ?? commit.message ?? '',
    author: {
      id: commit.author?.id?.toString() ?? '',
      name: commit.author?.login ?? commit.commit?.author?.name ?? 'unknown',
      email: commit.commit?.author?.email,
      avatarUrl: commit.author?.avatar_url ?? '',
    },
    committer: {
      id: commit.committer?.id?.toString() ?? '',
      name: commit.committer?.login ?? commit.commit?.committer?.name ?? 'unknown',
      email: commit.commit?.committer?.email,
      avatarUrl: commit.committer?.avatar_url ?? '',
    },
    timestamp: new Date(commit.commit?.author?.date ?? commit.created ?? Date.now()),
    url: commit.html_url ?? commit.url ?? '',
  });

  private mapWebhook = (hook: GiteaWebhook): Webhook => ({
    id: hook.id.toString(),
    url: hook.config.url,
    events: hook.events,
    active: hook.active,
    createdAt: new Date(hook.created_at),
  });

  private mapWorkflowRun = (run: GiteaWorkflowRun): WorkflowRun => ({
    id: run.id.toString(),
    name: run.workflow_name || 'Workflow',
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commitSha: run.head_sha,
    url: run.html_url,
    createdAt: new Date(run.created_at),
    updatedAt: new Date(run.updated_at),
  });

  private mapRelease = (release: GiteaRelease): Release => ({
    id: release.id.toString(),
    tagName: release.tag_name,
    name: release.name,
    body: release.body,
    draft: release.draft,
    prerelease: release.prerelease,
    url: release.html_url,
    author: {
      id: release.author.id.toString(),
      name: release.author.full_name || release.author.login,
      avatarUrl: release.author.avatar_url,
    },
    createdAt: new Date(release.created_at),
    publishedAt: release.published_at ? new Date(release.published_at) : null,
  });

  private createApiError(status: number, message: string, path: string): never {
    if (status === 401) {
      throw createProviderError('gitea', 'UNAUTHORIZED', 'Invalid or expired Gitea token', {
        statusCode: 401,
      });
    }
    if (status === 403) {
      throw createProviderError('gitea', 'FORBIDDEN', `Access denied: ${message}`, {
        statusCode: 403,
      });
    }
    if (status === 404) {
      throw createProviderError('gitea', 'NOT_FOUND', `Resource not found: ${message}`, {
        statusCode: 404,
      });
    }
    throw createProviderError('gitea', 'API_ERROR', `Gitea API error (${path}): ${message}`, {
      statusCode: status,
      retryable: status >= 500,
    });
  }
}

interface GiteaRepository {
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
  html_url: string;
  ssh_url: string;
  clone_url: string;
  default_branch: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string;
  created_at: string;
  updated_at: string;
}

interface GiteaBranch {
  name: string;
  commit: {
    id: string;
    message: string;
  };
  protected: boolean;
}

interface GiteaCommit {
  sha: string;
  message?: string;
  html_url?: string;
  url?: string;
  created?: string;
  commit?: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  author?: { id: number; login: string; avatar_url: string };
  committer?: { id: number; login: string; avatar_url: string };
}

interface GiteaWebhook {
  id: number;
  config: { url: string; content_type: string; secret?: string };
  events: string[];
  active: boolean;
  created_at: string;
}

interface GiteaWorkflowRun {
  id: number;
  workflow_name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface GiteaRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  created_at: string;
  published_at: string;
  author: {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
  };
}

export function createGiteaProvider(config: GiteaConfig): GiteaProvider {
  return new GiteaProvider(config);
}

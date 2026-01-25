import { Octokit } from 'octokit';
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

interface GitHubConfig extends GitProviderConfig {
  type: 'github';
  owner?: string;
}

export class GitHubProvider implements GitProvider {
  readonly type = 'github' as const;
  private client: Octokit;
  private defaultOwner?: string;

  constructor(config: GitHubConfig) {
    this.client = new Octokit({ auth: config.token });
    this.defaultOwner = config.owner;
  }

  async listRepos(options?: ListReposOptions): Promise<ListReposResponse> {
    const perPage = options?.perPage ?? 30;
    const page = options?.page ?? 1;

    try {
      let response;
      if (options?.org) {
        response = await this.client.rest.repos.listForOrg({
          org: options.org,
          type: options.type as 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member' | undefined,
          sort: options.sort,
          direction: options.direction,
          per_page: perPage,
          page,
        });
      } else {
        response = await this.client.rest.repos.listForAuthenticatedUser({
          type: options?.type as 'all' | 'public' | 'private' | undefined,
          sort: options?.sort,
          direction: options?.direction,
          per_page: perPage,
          page,
        });
      }

      const repos = response.data.map(this.mapRepository);
      const linkHeader = response.headers.link ?? '';
      const hasNextPage = linkHeader.includes('rel="next"');
      const hasPrevPage = linkHeader.includes('rel="prev"');

      return {
        data: repos,
        pagination: {
          page,
          perPage,
          total: repos.length,
          totalPages: hasNextPage ? page + 1 : page,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'listRepos');
    }
  }

  async getRepo(owner: string, name: string): Promise<Repository> {
    try {
      const { data } = await this.client.rest.repos.get({ owner, repo: name });
      return this.mapRepository(data);
    } catch (error) {
      throw this.handleError(error, 'getRepo');
    }
  }

  async createRepo(options: CreateRepoOptions): Promise<Repository> {
    try {
      const { data } = await this.client.rest.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description,
        private: options.isPrivate ?? true,
        auto_init: options.autoInit ?? true,
        gitignore_template: options.gitignoreTemplate,
        license_template: options.licenseTemplate,
      });
      return this.mapRepository(data);
    } catch (error) {
      throw this.handleError(error, 'createRepo');
    }
  }

  async createRepoFromTemplate(options: CreateRepoFromTemplateOptions): Promise<Repository> {
    try {
      const { data } = await this.client.rest.repos.createUsingTemplate({
        template_owner: options.templateOwner,
        template_repo: options.templateRepo,
        name: options.name,
        description: options.description,
        private: options.isPrivate ?? true,
        include_all_branches: options.includeAllBranches ?? false,
      });
      return this.mapRepository(data);
    } catch (error) {
      throw this.handleError(error, 'createRepoFromTemplate');
    }
  }

  async deleteRepo(owner: string, name: string): Promise<void> {
    try {
      await this.client.rest.repos.delete({ owner, repo: name });
    } catch (error) {
      throw this.handleError(error, 'deleteRepo');
    }
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    try {
      const { data } = await this.client.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });
      return data.map((b) => ({
        name: b.name,
        sha: b.commit.sha,
        protected: b.protected,
      }));
    } catch (error) {
      throw this.handleError(error, 'getBranches');
    }
  }

  async getDefaultBranch(owner: string, repo: string): Promise<Branch> {
    try {
      const { data: repoData } = await this.client.rest.repos.get({ owner, repo });
      const { data: branchData } = await this.client.rest.repos.getBranch({
        owner,
        repo,
        branch: repoData.default_branch,
      });
      return {
        name: branchData.name,
        sha: branchData.commit.sha,
        protected: branchData.protected,
      };
    } catch (error) {
      throw this.handleError(error, 'getDefaultBranch');
    }
  }

  async getCommits(
    owner: string,
    repo: string,
    options?: ListCommitsOptions
  ): Promise<ListCommitsResponse> {
    const perPage = options?.perPage ?? 30;
    const page = options?.page ?? 1;

    try {
      const { data, headers } = await this.client.rest.repos.listCommits({
        owner,
        repo,
        sha: options?.branch,
        since: options?.since?.toISOString(),
        until: options?.until?.toISOString(),
        author: options?.author,
        per_page: perPage,
        page,
      });

      const commits = data.map(this.mapCommit);
      const linkHeader = headers.link ?? '';
      const hasNextPage = linkHeader.includes('rel="next"');
      const hasPrevPage = linkHeader.includes('rel="prev"');

      return {
        data: commits,
        pagination: {
          page,
          perPage,
          total: commits.length,
          totalPages: hasNextPage ? page + 1 : page,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'getCommits');
    }
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<Commit> {
    try {
      const { data } = await this.client.rest.repos.getCommit({ owner, repo, ref: sha });
      return this.mapCommit(data);
    } catch (error) {
      throw this.handleError(error, 'getCommit');
    }
  }

  async getWebhooks(owner: string, repo: string): Promise<Webhook[]> {
    try {
      const { data } = await this.client.rest.repos.listWebhooks({ owner, repo });
      return data.map(this.mapWebhook);
    } catch (error) {
      throw this.handleError(error, 'getWebhooks');
    }
  }

  async createWebhook(
    owner: string,
    repo: string,
    config: WebhookConfig
  ): Promise<Webhook> {
    try {
      const { data } = await this.client.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: config.url,
          secret: config.secret,
          content_type: 'json',
        },
        events: config.events,
        active: config.active ?? true,
      });
      return this.mapWebhook(data);
    } catch (error) {
      throw this.handleError(error, 'createWebhook');
    }
  }

  async updateWebhook(
    owner: string,
    repo: string,
    webhookId: string,
    config: Partial<WebhookConfig>
  ): Promise<Webhook> {
    try {
      const { data } = await this.client.rest.repos.updateWebhook({
        owner,
        repo,
        hook_id: parseInt(webhookId, 10),
        config: config.url ? { url: config.url, secret: config.secret, content_type: 'json' } : undefined,
        events: config.events,
        active: config.active,
      });
      return this.mapWebhook(data);
    } catch (error) {
      throw this.handleError(error, 'updateWebhook');
    }
  }

  async deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void> {
    try {
      await this.client.rest.repos.deleteWebhook({
        owner,
        repo,
        hook_id: parseInt(webhookId, 10),
      });
    } catch (error) {
      throw this.handleError(error, 'deleteWebhook');
    }
  }

  async getWorkflowRuns(
    owner: string,
    repo: string,
    options?: ListWorkflowRunsOptions
  ): Promise<ListWorkflowRunsResponse> {
    const perPage = options?.perPage ?? 30;
    const page = options?.page ?? 1;

    try {
      const { data, headers } = await this.client.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch: options?.branch,
        event: options?.event,
        status: options?.status as 'queued' | 'in_progress' | 'completed' | undefined,
        per_page: perPage,
        page,
      });

      const runs = data.workflow_runs.map(this.mapWorkflowRun);
      const linkHeader = headers.link ?? '';
      const hasNextPage = linkHeader.includes('rel="next"');
      const hasPrevPage = linkHeader.includes('rel="prev"');

      return {
        data: runs,
        pagination: {
          page,
          perPage,
          total: data.total_count,
          totalPages: Math.ceil(data.total_count / perPage),
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'getWorkflowRuns');
    }
  }

  async getReleases(owner: string, repo: string): Promise<Release[]> {
    try {
      const { data } = await this.client.rest.repos.listReleases({
        owner,
        repo,
        per_page: 100,
      });
      return data.map(this.mapRelease);
    } catch (error) {
      throw this.handleError(error, 'getReleases');
    }
  }

  async getLatestRelease(owner: string, repo: string): Promise<Release | null> {
    try {
      const { data } = await this.client.rest.repos.getLatestRelease({ owner, repo });
      return this.mapRelease(data);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw this.handleError(error, 'getLatestRelease');
    }
  }

  async createRelease(
    owner: string,
    repo: string,
    options: CreateReleaseOptions
  ): Promise<Release> {
    try {
      const { data } = await this.client.rest.repos.createRelease({
        owner,
        repo,
        tag_name: options.tagName,
        name: options.name,
        body: options.body,
        target_commitish: options.targetCommitish,
        draft: options.draft ?? false,
        prerelease: options.prerelease ?? false,
      });
      return this.mapRelease(data);
    } catch (error) {
      throw this.handleError(error, 'createRelease');
    }
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    try {
      const { data } = await this.client.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw createProviderError('github', 'NOT_A_FILE', `Path ${path} is not a file`);
      }

      if (!('content' in data)) {
        throw createProviderError('github', 'NO_CONTENT', `No content available for ${path}`);
      }

      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      throw this.handleError(error, 'getFileContent');
    }
  }

  private mapRepository = (repo: Record<string, unknown>): Repository => {
    const r = repo as {
      id: number;
      name: string;
      full_name: string;
      description?: string | null;
      html_url: string;
      clone_url?: string;
      ssh_url?: string;
      default_branch?: string;
      private: boolean;
      fork: boolean;
      owner?: { login: string; id: number; avatar_url: string } | null;
      language?: string | null;
      stargazers_count?: number;
      forks_count?: number;
      open_issues_count?: number;
      created_at?: string | null;
      updated_at?: string | null;
    };
    return {
      id: r.id.toString(),
      name: r.name,
      fullName: r.full_name,
      description: r.description ?? null,
      url: r.html_url,
      cloneUrl: r.clone_url ?? `https://github.com/${r.full_name}.git`,
      sshUrl: r.ssh_url ?? `git@github.com:${r.full_name}.git`,
      defaultBranch: r.default_branch ?? 'main',
      isPrivate: r.private,
      isFork: r.fork,
      owner: {
        id: r.owner?.id.toString() ?? '',
        name: r.owner?.login ?? '',
        avatarUrl: r.owner?.avatar_url,
      },
      language: r.language ?? null,
      starCount: r.stargazers_count ?? 0,
      forkCount: r.forks_count ?? 0,
      openIssuesCount: r.open_issues_count ?? 0,
      createdAt: new Date(r.created_at ?? Date.now()),
      updatedAt: new Date(r.updated_at ?? Date.now()),
    };
  };

  private mapCommit = (commit: Record<string, unknown>): Commit => {
    const c = commit as {
      sha: string;
      commit: {
        message: string;
        author?: { name?: string; email?: string; date?: string } | null;
        committer?: { name?: string; email?: string; date?: string } | null;
      };
      html_url: string;
      author?: { login?: string; id?: number; avatar_url?: string } | null;
      committer?: { login?: string; id?: number; avatar_url?: string } | null;
    };
    return {
      sha: c.sha,
      message: c.commit.message,
      author: {
        id: c.author?.id?.toString() ?? '',
        name: c.author?.login ?? c.commit.author?.name ?? 'Unknown',
        email: c.commit.author?.email,
        avatarUrl: c.author?.avatar_url,
      },
      committer: {
        id: c.committer?.id?.toString() ?? '',
        name: c.committer?.login ?? c.commit.committer?.name ?? 'Unknown',
        email: c.commit.committer?.email,
        avatarUrl: c.committer?.avatar_url,
      },
      timestamp: new Date(c.commit.author?.date ?? Date.now()),
      url: c.html_url,
    };
  };

  private mapWebhook = (hook: {
    id: number;
    config: { url?: string };
    events: string[];
    active: boolean;
    created_at: string;
  }): Webhook => ({
    id: hook.id.toString(),
    url: hook.config.url ?? '',
    events: hook.events,
    active: hook.active,
    createdAt: new Date(hook.created_at),
  });

  private mapWorkflowRun = (run: Record<string, unknown>): WorkflowRun => {
    const r = run as {
      id: number;
      name?: string | null;
      status?: string | null;
      conclusion?: string | null;
      head_branch?: string | null;
      head_sha: string;
      html_url: string;
      created_at: string;
      updated_at: string;
    };
    return {
      id: r.id.toString(),
      name: r.name ?? 'Unknown',
      status: (r.status as WorkflowRun['status']) ?? 'queued',
      conclusion: r.conclusion as WorkflowRun['conclusion'],
      branch: r.head_branch ?? '',
      commitSha: r.head_sha,
      url: r.html_url,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  };

  private mapRelease = (release: Record<string, unknown>): Release => {
    const r = release as {
      id: number;
      tag_name: string;
      name?: string | null;
      body?: string | null;
      draft: boolean;
      prerelease: boolean;
      html_url: string;
      author: { login: string; id: number; avatar_url: string };
      created_at: string;
      published_at?: string | null;
    };
    return {
      id: r.id.toString(),
      tagName: r.tag_name,
      name: r.name ?? r.tag_name,
      body: r.body ?? '',
      draft: r.draft,
      prerelease: r.prerelease,
      url: r.html_url,
      author: {
        id: r.author.id.toString(),
        name: r.author.login,
        avatarUrl: r.author.avatar_url,
      },
      createdAt: new Date(r.created_at),
      publishedAt: r.published_at ? new Date(r.published_at) : null,
    };
  };

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'status' in error &&
      (error as { status: number }).status === 404
    );
  }

  private handleError(error: unknown, operation: string): never {
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status;
      const message = error.message;

      if (status === 401) {
        throw createProviderError('github', 'UNAUTHORIZED', 'Invalid or expired GitHub token', {
          statusCode: 401,
          cause: error,
        });
      }
      if (status === 403) {
        throw createProviderError('github', 'FORBIDDEN', `Access denied: ${message}`, {
          statusCode: 403,
          retryable: message.includes('rate limit'),
          cause: error,
        });
      }
      if (status === 404) {
        throw createProviderError('github', 'NOT_FOUND', `Resource not found: ${message}`, {
          statusCode: 404,
          cause: error,
        });
      }
      if (status === 422) {
        throw createProviderError('github', 'VALIDATION_ERROR', `Validation failed: ${message}`, {
          statusCode: 422,
          cause: error,
        });
      }

      throw createProviderError('github', 'API_ERROR', `GitHub API error in ${operation}: ${message}`, {
        statusCode: status,
        retryable: status >= 500,
        cause: error,
      });
    }

    throw createProviderError(
      'github',
      'UNKNOWN_ERROR',
      `Unknown error in ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export function createGitHubProvider(config: Omit<GitHubConfig, 'type'>): GitHubProvider {
  return new GitHubProvider({ ...config, type: 'github' });
}

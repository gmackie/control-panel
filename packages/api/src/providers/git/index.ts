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
  GitProviderType,
} from './types';

export * from './types';
export { GitHubProvider, createGitHubProvider } from './adapters/github';
export { GiteaProvider, createGiteaProvider } from './adapters/gitea';

export interface GitProvider {
  readonly type: GitProviderType;

  listRepos(options?: ListReposOptions): Promise<ListReposResponse>;
  
  getRepo(owner: string, name: string): Promise<Repository>;
  
  createRepo(options: CreateRepoOptions): Promise<Repository>;
  
  createRepoFromTemplate(options: CreateRepoFromTemplateOptions): Promise<Repository>;
  
  deleteRepo(owner: string, name: string): Promise<void>;

  getBranches(owner: string, repo: string): Promise<Branch[]>;
  
  getDefaultBranch(owner: string, repo: string): Promise<Branch>;

  getCommits(
    owner: string,
    repo: string,
    options?: ListCommitsOptions
  ): Promise<ListCommitsResponse>;
  
  getCommit(owner: string, repo: string, sha: string): Promise<Commit>;

  getWebhooks(owner: string, repo: string): Promise<Webhook[]>;
  
  createWebhook(
    owner: string,
    repo: string,
    config: WebhookConfig
  ): Promise<Webhook>;
  
  updateWebhook(
    owner: string,
    repo: string,
    webhookId: string,
    config: Partial<WebhookConfig>
  ): Promise<Webhook>;
  
  deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void>;

  getWorkflowRuns(
    owner: string,
    repo: string,
    options?: ListWorkflowRunsOptions
  ): Promise<ListWorkflowRunsResponse>;

  getReleases(owner: string, repo: string): Promise<Release[]>;
  
  getLatestRelease(owner: string, repo: string): Promise<Release | null>;
  
  createRelease(
    owner: string,
    repo: string,
    options: CreateReleaseOptions
  ): Promise<Release>;

  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string>;
}

export interface GitProviderConfig {
  type: GitProviderType;
  token: string;
  baseUrl?: string;
}

export function isGitProvider(obj: unknown): obj is GitProvider {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'listRepos' in obj &&
    'getRepo' in obj &&
    'createRepo' in obj
  );
}

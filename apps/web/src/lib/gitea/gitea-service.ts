import { GiteaClient, GiteaRepository, GiteaWorkflowRun as ClientWorkflowRun } from './client';
import { GiteaWorkflowRun } from '@/types/deployments';

export interface GiteaConfig {
  baseUrl: string;
  token: string;
  organization?: string;
}

export interface TriggerWorkflowParams {
  environment: string;
  commit?: string;
  deployment_id?: string;
  [key: string]: any;
}

export class GiteaService {
  private client: GiteaClient;
  private config: GiteaConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.GITEA_URL || 'https://git.gmac.io',
      token: process.env.GITEA_TOKEN || '',
      organization: process.env.GITEA_ORG || 'gmackie',
    };

    this.client = new GiteaClient({
      baseUrl: this.config.baseUrl,
      token: this.config.token,
    });
  }

  private transformWorkflowRun(run: ClientWorkflowRun, repoName: string, repoFullName: string): GiteaWorkflowRun {
    return {
      id: run.id,
      name: run.workflow_name || 'Workflow',
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      status: run.status,
      conclusion: run.conclusion || undefined,
      created_at: run.created_at,
      updated_at: run.updated_at,
      run_number: run.run_number,
      event: run.event,
      actor: {
        login: run.actor?.login || 'unknown',
        id: run.actor?.id || 0,
        avatar_url: run.actor?.avatar_url || '',
      },
      repository: {
        name: repoName,
        full_name: repoFullName,
        owner: {
          login: repoFullName.split('/')[0],
        },
      },
      head_commit: {
        id: run.commit?.id || run.head_sha,
        message: run.commit?.message || '',
        author: {
          name: run.commit?.author?.name || '',
          email: run.commit?.author?.email || '',
        },
        timestamp: run.commit?.timestamp || run.created_at,
      },
      jobs: [], // Jobs require a separate API call if needed
    };
  }

  async getWorkflowRuns(options: {
    owner?: string;
    repo?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<GiteaWorkflowRun[]> {
    try {
      const { owner, repo, status, limit = 50 } = options;
      
      // If specific repo is provided, get workflows for that repo
      if (owner && repo) {
        const result = await this.client.listWorkflowRuns(owner, repo, { 
          status, 
          limit 
        });
        return (result.workflow_runs || []).map(run => 
          this.transformWorkflowRun(run, repo, `${owner}/${repo}`)
        );
      }

      // Otherwise, get workflows from all repositories
      const repos = await this.getRepositories(owner || this.config.organization);
      const allRuns: GiteaWorkflowRun[] = [];

      // Fetch workflow runs from each repository (limit to first 10 repos to avoid rate limiting)
      const reposToCheck = repos.slice(0, 10);
      
      await Promise.all(
        reposToCheck.map(async (repoData) => {
          try {
            const [repoOwner, repoName] = repoData.full_name.split('/');
            const result = await this.client.listWorkflowRuns(repoOwner, repoName, { 
              status, 
              limit: 5 
            });
            const runs = (result.workflow_runs || []).map(run => 
              this.transformWorkflowRun(run, repoName, repoData.full_name)
            );
            allRuns.push(...runs);
          } catch (error) {
            // Skip repos that don't have workflows or have errors
            console.debug(`No workflows found for ${repoData.full_name}`);
          }
        })
      );

      // Sort by created_at descending and limit results
      return allRuns
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching Gitea workflow runs:', error);
      return [];
    }
  }

  async triggerWorkflow(
    owner: string,
    repo: string,
    workflowFile: string,
    params: TriggerWorkflowParams
  ): Promise<{ success: boolean; runId?: number; error?: string }> {
    try {
      // Gitea Actions uses dispatch events to trigger workflows
      // This requires the workflow to have workflow_dispatch trigger
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: params.ref || 'main',
            inputs: params,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to trigger workflow: ${error}`);
      }

      return {
        success: true,
        // Gitea doesn't return run ID immediately, would need to poll
      };
    } catch (error) {
      console.error('Error triggering Gitea workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<GiteaWorkflowRun | null> {
    try {
      const run = await this.client.getWorkflowRun(owner, repo, runId);
      return this.transformWorkflowRun(run, repo, `${owner}/${repo}`);
    } catch (error) {
      console.error('Error fetching Gitea workflow run:', error);
      return null;
    }
  }

  async cancelWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.cancelWorkflowRun(owner, repo, runId);
      return { success: true };
    } catch (error) {
      console.error('Error cancelling Gitea workflow run:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getRepositories(owner?: string): Promise<Array<{
    id: number;
    name: string;
    full_name: string;
    description?: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    clone_url: string;
    ssh_url: string;
    updated_at: string;
    language?: string;
    stars_count?: number;
    forks_count?: number;
    open_issues_count?: number;
  }>> {
    try {
      // First try user's repositories (requires valid token)
      const userResponse = await fetch(
        `${this.config.baseUrl}/api/v1/user/repos?limit=50`,
        {
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let repos: GiteaRepository[] = [];

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (Array.isArray(userData)) {
          repos = userData;
        }
      }

      // If user endpoint failed or returned empty, try search endpoint (public)
      if (repos.length === 0) {
        const ownerQuery = owner || this.config.organization || 'gmackie';
        const searchUrl = `${this.config.baseUrl}/api/v1/repos/search?q=${ownerQuery}&limit=50`;
        
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData?.data && Array.isArray(searchData.data)) {
            repos = searchData.data;
          }
        }
      }

      // Filter by owner if specified
      const filteredRepos = owner 
        ? repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase())
        : repos;

      return filteredRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        updated_at: repo.updated_at,
        language: repo.language,
        stars_count: repo.stars_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
      }));
    } catch (error) {
      console.error('Error fetching Gitea repositories:', error);
      return [];
    }
  }

  async getRepository(owner: string, repo: string): Promise<GiteaRepository | null> {
    try {
      return await this.client.getRepository(owner, repo);
    } catch (error) {
      console.error('Error fetching repository:', error);
      return null;
    }
  }

  async getCommits(owner: string, repo: string, options?: { sha?: string; limit?: number }): Promise<any[]> {
    try {
      return await this.client.getCommits(owner, repo, options);
    } catch (error) {
      console.error('Error fetching commits:', error);
      return [];
    }
  }

  async getBranches(owner: string, repo: string): Promise<any[]> {
    try {
      return await this.client.listBranches(owner, repo);
    } catch (error) {
      console.error('Error fetching branches:', error);
      return [];
    }
  }

  async getPullRequests(owner: string, repo: string, state?: 'open' | 'closed' | 'all'): Promise<any[]> {
    try {
      return await this.client.listPullRequests(owner, repo, { state });
    } catch (error) {
      console.error('Error fetching pull requests:', error);
      return [];
    }
  }

  async createWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    events: string[] = ['push', 'pull_request']
  ): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const webhook = await this.client.createWebhook(owner, repo, {
        type: 'gitea',
        config: {
          url: webhookUrl,
          content_type: 'json',
        },
        events,
        active: true,
      });

      return {
        success: true,
        id: webhook.id,
      };
    } catch (error) {
      console.error('Error creating Gitea webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      return await this.client.getCurrentUser();
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  async getOrganizations(): Promise<any[]> {
    try {
      return await this.client.listOrganizations();
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    return await this.client.healthCheck();
  }
}

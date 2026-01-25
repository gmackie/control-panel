import type { 
  ProvisioningContext, 
  DeployProvisioningResult,
  ProvisioningStep,
} from './types';

interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  link?: {
    type: string;
    repo: string;
    repoId: number;
  };
  latestDeployments?: Array<{
    url: string;
    alias: string[];
  }>;
}

interface VercelApiResponse {
  id?: string;
  name?: string;
  accountId?: string;
  error?: { message: string; code: string };
}

export class VercelProvisioner {
  private token: string;
  private teamId?: string;
  private baseUrl = 'https://api.vercel.com';

  constructor(token: string, teamId?: string) {
    this.token = token;
    this.teamId = teamId;
  }

  private getTeamParam(): string {
    return this.teamId ? `?teamId=${this.teamId}` : '';
  }

  async createProject(
    name: string, 
    options?: { 
      gitRepository?: { type: string; repo: string }; 
      framework?: string;
    }
  ): Promise<DeployProvisioningResult> {
    try {
      const body: Record<string, unknown> = {
        name,
        framework: options?.framework ?? 'nextjs',
      };

      if (options?.gitRepository) {
        body.gitRepository = options.gitRepository;
      }

      const response = await fetch(`${this.baseUrl}/v10/projects${this.getTeamParam()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json() as VercelApiResponse;
        return {
          provider: 'vercel',
          resourceType: 'deployment_project',
          status: 'failed',
          error: `Failed to create Vercel project: ${error.error?.message ?? response.statusText}`,
        };
      }

      const project = await response.json() as VercelProject;

      return {
        provider: 'vercel',
        resourceType: 'deployment_project',
        status: 'success',
        resourceId: project.id,
        resourceName: project.name,
        message: `Vercel project "${project.name}" created`,
        credentials: {
          VERCEL_PROJECT_ID: project.id,
          VERCEL_ORG_ID: project.accountId,
        },
      };
    } catch (error) {
      return {
        provider: 'vercel',
        resourceType: 'deployment_project',
        status: 'failed',
        error: `Vercel provisioning error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async linkGitRepository(
    projectId: string, 
    repoType: 'github' | 'gitlab' | 'bitbucket',
    repoFullName: string
  ): Promise<DeployProvisioningResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v10/projects/${projectId}/link${this.getTeamParam()}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: repoType,
            repo: repoFullName,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json() as VercelApiResponse;
        return {
          provider: 'vercel',
          resourceType: 'deployment_project',
          status: 'failed',
          error: `Failed to link repository: ${error.error?.message ?? response.statusText}`,
        };
      }

      return {
        provider: 'vercel',
        resourceType: 'deployment_project',
        status: 'success',
        resourceId: projectId,
        message: `Repository ${repoFullName} linked to Vercel project`,
      };
    } catch (error) {
      return {
        provider: 'vercel',
        resourceType: 'deployment_project',
        status: 'failed',
        error: `Git linking error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async setEnvironmentVariables(
    projectId: string,
    envVars: Array<{ key: string; value: string; target?: string[] }>
  ): Promise<void> {
    for (const envVar of envVars) {
      await fetch(
        `${this.baseUrl}/v10/projects/${projectId}/env${this.getTeamParam()}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: envVar.key,
            value: envVar.value,
            target: envVar.target ?? ['production', 'preview', 'development'],
            type: 'encrypted',
          }),
        }
      );
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    await fetch(`${this.baseUrl}/v9/projects/${projectId}${this.getTeamParam()}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
  }

  createProvisioningStep(): ProvisioningStep {
    return {
      name: 'Provision Vercel Project',
      provider: 'vercel',
      shouldRun: (ctx) => ctx.deployProvider === 'vercel',
      execute: async (ctx) => {
        const result = await this.createProject(ctx.applicationSlug);
        
        if (result.status === 'success' && result.resourceId && ctx.repositoryUrl) {
          const repoMatch = ctx.repositoryUrl.match(/github\.com\/(.+?)(?:\.git)?$/);
          if (repoMatch?.[1]) {
            await this.linkGitRepository(result.resourceId, 'github', repoMatch[1]);
          }
        }
        
        return result;
      },
      rollback: async (_ctx, result) => {
        if (result.resourceId) {
          await this.deleteProject(result.resourceId);
        }
      },
    };
  }
}

export function createVercelProvisioner(token: string, teamId?: string): VercelProvisioner {
  return new VercelProvisioner(token, teamId);
}

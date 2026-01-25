import type { 
  ProvisioningContext, 
  DatabaseProvisioningResult,
  ProvisioningStep,
} from './types';

interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  created_at: string;
  connection_uris: Array<{
    connection_uri: string;
    connection_parameters: {
      database: string;
      host: string;
      password: string;
      role: string;
    };
  }>;
}

interface NeonApiResponse<T> {
  project?: T;
  projects?: T[];
  error?: { message: string };
}

export class NeonProvisioner {
  private apiKey: string;
  private baseUrl = 'https://console.neon.tech/api/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createProject(name: string, region = 'aws-us-east-1'): Promise<DatabaseProvisioningResult> {
    try {
      const response = await fetch(`${this.baseUrl}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: {
            name,
            region_id: region,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          provider: 'neon',
          resourceType: 'database',
          status: 'failed',
          error: `Failed to create Neon project: ${error}`,
        };
      }

      const data = await response.json() as NeonApiResponse<NeonProject>;
      const project = data.project;

      if (!project) {
        return {
          provider: 'neon',
          resourceType: 'database',
          status: 'failed',
          error: 'No project returned from Neon API',
        };
      }

      const connectionUri = project.connection_uris?.[0];
      
      return {
        provider: 'neon',
        resourceType: 'database',
        status: 'success',
        resourceId: project.id,
        resourceName: project.name,
        message: `Neon project "${project.name}" created`,
        credentials: connectionUri ? {
          DATABASE_URL: connectionUri.connection_uri,
          DATABASE_HOST: connectionUri.connection_parameters.host,
          DATABASE_NAME: connectionUri.connection_parameters.database,
          DATABASE_USER: connectionUri.connection_parameters.role,
          DATABASE_PASSWORD: connectionUri.connection_parameters.password,
        } : undefined,
      };
    } catch (error) {
      return {
        provider: 'neon',
        resourceType: 'database',
        status: 'failed',
        error: `Neon provisioning error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  createProvisioningStep(): ProvisioningStep {
    return {
      name: 'Provision Neon Database',
      provider: 'neon',
      shouldRun: (ctx) => ctx.dbProvider === 'neon',
      execute: async (ctx) => {
        return this.createProject(ctx.applicationSlug);
      },
      rollback: async (_ctx, result) => {
        if (result.resourceId) {
          await this.deleteProject(result.resourceId);
        }
      },
    };
  }
}

export function createNeonProvisioner(apiKey: string): NeonProvisioner {
  return new NeonProvisioner(apiKey);
}

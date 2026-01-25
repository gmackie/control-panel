import { createProviderError } from '../../types';
import type { DatabaseProvider } from '../index';
import type {
  Database,
  DatabaseProject,
  DatabaseBranch,
  CreateDatabaseOptions,
  CreateBranchOptions,
  ConnectionStringOptions,
  ListDatabasesOptions,
  ListDatabasesResponse,
  DatabaseMetrics,
  DatabaseStatus,
} from '../types';

interface NeonConfig {
  apiKey: string;
}

const NEON_API = 'https://console.neon.tech/api/v2';

export class NeonProvider implements DatabaseProvider {
  readonly type = 'neon' as const;
  private apiKey: string;

  constructor(config: NeonConfig) {
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    const response = await fetch(`${NEON_API}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string };
      throw this.createApiError(response.status, error.message ?? response.statusText, path);
    }

    return response.json() as Promise<T>;
  }

  async listProjects(): Promise<DatabaseProject[]> {
    const data = await this.request<{ projects: NeonProject[] }>('/projects');
    return data.projects.map(this.mapProject);
  }

  async getProject(projectId: string): Promise<DatabaseProject> {
    const data = await this.request<{ project: NeonProject }>(`/projects/${projectId}`);
    return this.mapProject(data.project);
  }

  async createProject(name: string, region?: string): Promise<DatabaseProject> {
    const data = await this.request<{ project: NeonProject }>('/projects', {
      method: 'POST',
      body: {
        project: {
          name,
          region_id: region ?? 'aws-us-east-1',
        },
      },
    });
    return this.mapProject(data.project);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request(`/projects/${projectId}`, { method: 'DELETE' });
  }

  async listDatabases(options?: ListDatabasesOptions): Promise<ListDatabasesResponse> {
    if (!options?.projectId) {
      const projects = await this.listProjects();
      const allDatabases: Database[] = [];
      for (const project of projects) {
        allDatabases.push(...project.databases);
      }
      return {
        data: allDatabases,
        pagination: {
          page: 1,
          perPage: allDatabases.length,
          total: allDatabases.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const data = await this.request<{ databases: NeonDatabase[] }>(
      `/projects/${options.projectId}/databases`
    );
    const databases = data.databases.map(db => this.mapDatabase(db, options.projectId!));

    return {
      data: databases,
      pagination: {
        page: options.page ?? 1,
        perPage: options.perPage ?? databases.length,
        total: databases.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  async getDatabase(databaseId: string): Promise<Database> {
    const [projectId, dbName] = databaseId.split('/');
    if (!projectId || !dbName) {
      throw createProviderError('neon', 'INVALID_ID', 'Database ID must be in format projectId/databaseName');
    }

    const data = await this.request<{ databases: NeonDatabase[] }>(
      `/projects/${projectId}/databases`
    );
    const db = data.databases.find(d => d.name === dbName);
    if (!db) {
      throw createProviderError('neon', 'NOT_FOUND', `Database ${dbName} not found`, { statusCode: 404 });
    }
    return this.mapDatabase(db, projectId);
  }

  async createDatabase(options: CreateDatabaseOptions): Promise<Database> {
    let projectId = options.projectId;
    
    if (!projectId) {
      const project = await this.createProject(options.name, options.region);
      projectId = project.id;
    }

    const data = await this.request<{ database: NeonDatabase }>(
      `/projects/${projectId}/databases`,
      {
        method: 'POST',
        body: {
          database: {
            name: options.name,
            owner_name: 'neondb_owner',
          },
        },
      }
    );

    return this.mapDatabase(data.database, projectId);
  }

  async deleteDatabase(databaseId: string): Promise<void> {
    const [projectId, dbName] = databaseId.split('/');
    if (!projectId || !dbName) {
      throw createProviderError('neon', 'INVALID_ID', 'Database ID must be in format projectId/databaseName');
    }

    await this.request(`/projects/${projectId}/databases/${dbName}`, { method: 'DELETE' });
  }

  async getConnectionString(
    databaseId: string,
    options?: ConnectionStringOptions
  ): Promise<string> {
    const [projectId, dbName] = databaseId.split('/');
    if (!projectId) {
      throw createProviderError('neon', 'INVALID_ID', 'Database ID must be in format projectId/databaseName');
    }

    const branchId = options?.branch ?? 'main';
    
    const data = await this.request<{ uri: string }>(
      `/projects/${projectId}/connection_uri?database_name=${dbName ?? 'neondb'}&role_name=neondb_owner&branch_id=${branchId}&pooled=${options?.pooled ?? true}`
    );

    return data.uri;
  }

  async listBranches(projectId: string): Promise<DatabaseBranch[]> {
    const data = await this.request<{ branches: NeonBranch[] }>(`/projects/${projectId}/branches`);
    return data.branches.map(this.mapBranch);
  }

  async getBranch(projectId: string, branchId: string): Promise<DatabaseBranch> {
    const data = await this.request<{ branch: NeonBranch }>(`/projects/${projectId}/branches/${branchId}`);
    return this.mapBranch(data.branch);
  }

  async createBranch(projectId: string, options: CreateBranchOptions): Promise<DatabaseBranch> {
    const data = await this.request<{ branch: NeonBranch }>(`/projects/${projectId}/branches`, {
      method: 'POST',
      body: {
        branch: {
          name: options.name,
          parent_id: options.parentBranchId,
        },
      },
    });
    return this.mapBranch(data.branch);
  }

  async deleteBranch(projectId: string, branchId: string): Promise<void> {
    await this.request(`/projects/${projectId}/branches/${branchId}`, { method: 'DELETE' });
  }

  async getMetrics(databaseId: string): Promise<DatabaseMetrics> {
    const [projectId] = databaseId.split('/');
    if (!projectId) {
      throw createProviderError('neon', 'INVALID_ID', 'Database ID must be in format projectId/databaseName');
    }

    const data = await this.request<{ project: { consumption?: NeonConsumption } }>(
      `/projects/${projectId}`
    );

    return {
      connectionCount: data.project.consumption?.active_time_seconds ?? 0,
      storageBytes: data.project.consumption?.data_storage_bytes_hour ?? 0,
      computeSeconds: data.project.consumption?.compute_time_seconds ?? 0,
      dataTransferBytes: data.project.consumption?.data_transfer_bytes ?? 0,
    };
  }

  private mapProject = (project: NeonProject): DatabaseProject => {
    const databases = project.databases?.map(db => this.mapDatabase(db, project.id)) ?? [];
    const branches = project.branches?.map(this.mapBranch) ?? [];

    return {
      id: project.id,
      name: project.name,
      region: project.region_id,
      createdAt: new Date(project.created_at),
      databases,
      branches,
    };
  };

  private mapDatabase = (db: NeonDatabase, projectId: string): Database => {
    return {
      id: `${projectId}/${db.name}`,
      name: db.name,
      status: 'ready' as DatabaseStatus,
      region: '',
      size: null,
      connectionString: '',
      host: '',
      port: 5432,
      username: db.owner_name,
      databaseName: db.name,
      createdAt: new Date(db.created_at ?? Date.now()),
      updatedAt: new Date(db.updated_at ?? db.created_at ?? Date.now()),
    };
  };

  private mapBranch = (branch: NeonBranch): DatabaseBranch => {
    return {
      id: branch.id,
      name: branch.name,
      parentId: branch.parent_id ?? null,
      primary: branch.primary ?? false,
      createdAt: new Date(branch.created_at),
    };
  };

  private createApiError(status: number, message: string, path: string): never {
    if (status === 401) {
      throw createProviderError('neon', 'UNAUTHORIZED', 'Invalid or expired Neon API key', { statusCode: 401 });
    }
    if (status === 403) {
      throw createProviderError('neon', 'FORBIDDEN', `Access denied: ${message}`, { statusCode: 403 });
    }
    if (status === 404) {
      throw createProviderError('neon', 'NOT_FOUND', `Resource not found: ${message}`, { statusCode: 404 });
    }
    if (status === 400) {
      throw createProviderError('neon', 'VALIDATION_ERROR', `Invalid request: ${message}`, { statusCode: 400 });
    }
    throw createProviderError('neon', 'API_ERROR', `Neon API error (${path}): ${message}`, {
      statusCode: status,
      retryable: status >= 500,
    });
  }
}

interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  created_at: string;
  databases?: NeonDatabase[];
  branches?: NeonBranch[];
}

interface NeonDatabase {
  id: number;
  name: string;
  owner_name: string;
  created_at?: string;
  updated_at?: string;
}

interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  primary?: boolean;
  created_at: string;
}

interface NeonConsumption {
  active_time_seconds?: number;
  compute_time_seconds?: number;
  data_storage_bytes_hour?: number;
  data_transfer_bytes?: number;
}

export function createNeonProvider(config: NeonConfig): NeonProvider {
  return new NeonProvider(config);
}

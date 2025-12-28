/**
 * Supabase Management API Client
 * Monitor and manage Supabase projects
 */

export interface SupabaseProject {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  database: {
    host: string;
    version: string;
  };
  status: 'ACTIVE_HEALTHY' | 'ACTIVE_UNHEALTHY' | 'COMING_UP' | 'GOING_DOWN' | 'INACTIVE' | 'INIT_FAILED' | 'REMOVED' | 'RESTORING' | 'UNKNOWN' | 'UPGRADING' | 'PAUSING' | 'PAUSED';
}

export interface SupabaseOrganization {
  id: string;
  name: string;
  billing_email: string;
}

export interface SupabaseDatabase {
  host: string;
  version: string;
  status: string;
  size: number;
  tables_count: number;
}

export interface SupabaseUsage {
  database: {
    size: number;
    egress: number;
  };
  storage: {
    size: number;
    egress: number;
  };
  functions: {
    invocations: number;
    execution_time_ms: number;
  };
  auth: {
    mau: number; // Monthly Active Users
    total_users: number;
  };
  realtime: {
    messages: number;
    peak_connections: number;
  };
}

export interface SupabaseFunction {
  id: string;
  slug: string;
  name: string;
  version: number;
  status: 'ACTIVE' | 'REMOVED' | 'THROTTLED';
  created_at: string;
  updated_at: string;
}

export interface SupabaseSecret {
  name: string;
  value: string;
}

export class SupabaseManagementClient {
  private baseUrl = 'https://api.supabase.com';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Organizations
  async listOrganizations(): Promise<SupabaseOrganization[]> {
    return this.request<SupabaseOrganization[]>('/v1/organizations');
  }

  // Projects
  async listProjects(): Promise<SupabaseProject[]> {
    return this.request<SupabaseProject[]>('/v1/projects');
  }

  async getProject(projectRef: string): Promise<SupabaseProject> {
    return this.request<SupabaseProject>(`/v1/projects/${projectRef}`);
  }

  async pauseProject(projectRef: string): Promise<void> {
    await this.request(`/v1/projects/${projectRef}/pause`, { method: 'POST' });
  }

  async restoreProject(projectRef: string): Promise<void> {
    await this.request(`/v1/projects/${projectRef}/restore`, { method: 'POST' });
  }

  // Database
  async getDatabaseHealth(projectRef: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/v1/projects/${projectRef}/health`);
  }

  async runQuery(projectRef: string, query: string): Promise<any[]> {
    return this.request(`/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Functions
  async listFunctions(projectRef: string): Promise<SupabaseFunction[]> {
    return this.request<SupabaseFunction[]>(`/v1/projects/${projectRef}/functions`);
  }

  async getFunction(projectRef: string, functionSlug: string): Promise<SupabaseFunction> {
    return this.request<SupabaseFunction>(`/v1/projects/${projectRef}/functions/${functionSlug}`);
  }

  async deployFunction(projectRef: string, functionSlug: string, body: Blob): Promise<SupabaseFunction> {
    const response = await fetch(`${this.baseUrl}/v1/projects/${projectRef}/functions/${functionSlug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/zip',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to deploy function: ${response.statusText}`);
    }

    return response.json();
  }

  // Secrets
  async listSecrets(projectRef: string): Promise<SupabaseSecret[]> {
    return this.request<SupabaseSecret[]>(`/v1/projects/${projectRef}/secrets`);
  }

  async createSecrets(projectRef: string, secrets: SupabaseSecret[]): Promise<void> {
    await this.request(`/v1/projects/${projectRef}/secrets`, {
      method: 'POST',
      body: JSON.stringify(secrets),
    });
  }

  async deleteSecrets(projectRef: string, secretNames: string[]): Promise<void> {
    await this.request(`/v1/projects/${projectRef}/secrets`, {
      method: 'DELETE',
      body: JSON.stringify(secretNames),
    });
  }

  // API Keys
  async getApiKeys(projectRef: string): Promise<{ anon_key: string; service_role_key: string }> {
    return this.request(`/v1/projects/${projectRef}/api-keys`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.listProjects();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer
export class SupabaseService {
  private client: SupabaseManagementClient;

  constructor() {
    this.client = new SupabaseManagementClient(
      process.env.SUPABASE_ACCESS_TOKEN || ''
    );
  }

  async getProjects() {
    return this.client.listProjects();
  }

  async getProject(projectRef: string) {
    return this.client.getProject(projectRef);
  }

  async getProjectWithDetails(projectRef: string) {
    const [project, functions, health] = await Promise.all([
      this.client.getProject(projectRef),
      this.client.listFunctions(projectRef).catch(() => []),
      this.client.getDatabaseHealth(projectRef).catch(() => ({ status: 'unknown' })),
    ]);

    return {
      ...project,
      functions,
      health,
    };
  }

  async getOrganizations() {
    return this.client.listOrganizations();
  }

  async getProjectFunctions(projectRef: string) {
    return this.client.listFunctions(projectRef);
  }

  async getDatabaseHealth(projectRef: string) {
    return this.client.getDatabaseHealth(projectRef);
  }

  async getDashboardStats() {
    const projects = await this.client.listProjects();
    
    const healthyProjects = projects.filter(p => p.status === 'ACTIVE_HEALTHY');
    const unhealthyProjects = projects.filter(p => 
      p.status === 'ACTIVE_UNHEALTHY' || p.status === 'INIT_FAILED'
    );
    const pausedProjects = projects.filter(p => p.status === 'PAUSED');

    // Get functions count for each project
    const functionsPromises = projects.slice(0, 10).map(async p => {
      try {
        const functions = await this.client.listFunctions(p.id);
        return functions.length;
      } catch {
        return 0;
      }
    });

    const functionsCounts = await Promise.all(functionsPromises);
    const totalFunctions = functionsCounts.reduce((a, b) => a + b, 0);

    return {
      totalProjects: projects.length,
      healthyProjects: healthyProjects.length,
      unhealthyProjects: unhealthyProjects.length,
      pausedProjects: pausedProjects.length,
      totalFunctions,
      projectsByRegion: projects.reduce((acc, p) => {
        acc[p.region] = (acc[p.region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async pauseProject(projectRef: string) {
    return this.client.pauseProject(projectRef);
  }

  async restoreProject(projectRef: string) {
    return this.client.restoreProject(projectRef);
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const supabaseService = new SupabaseService();

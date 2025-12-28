/**
 * Neon API Client
 * Monitor PostgreSQL databases, branches, compute endpoints, and usage metrics
 * API Docs: https://api-docs.neon.tech/reference/getting-started-with-neon-api
 */

export interface NeonProject {
  id: string;
  platform_id: string;
  region_id: string;
  name: string;
  provisioner: 'k8s-pod' | 'k8s-neonvm';
  pg_version: number;
  proxy_host: string;
  branch_logical_size_limit: number;
  branch_logical_size_limit_bytes: number;
  store_passwords: boolean;
  cpu_used_sec: number;
  active_time_seconds: number;
  compute_time_seconds: number;
  written_data_bytes: number;
  data_transfer_bytes: number;
  data_storage_bytes_hour: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface NeonBranch {
  id: string;
  project_id: string;
  parent_id: string | null;
  parent_lsn: string | null;
  name: string;
  current_state: 'init' | 'ready' | 'deleting';
  pending_state: 'init' | 'ready' | 'deleting' | null;
  logical_size: number;
  physical_size: number;
  created_at: string;
  updated_at: string;
  primary: boolean;
  default: boolean;
  protected: boolean;
}

export interface NeonEndpoint {
  id: string;
  project_id: string;
  branch_id: string;
  host: string;
  type: 'read_only' | 'read_write';
  region_id: string;
  current_state: 'init' | 'active' | 'idle';
  pending_state: 'init' | 'active' | 'idle' | null;
  autoscaling_limit_min_cu: number;
  autoscaling_limit_max_cu: number;
  pooler_enabled: boolean;
  pooler_mode: 'transaction' | 'session';
  disabled: boolean;
  passwordless_access: boolean;
  created_at: string;
  updated_at: string;
  proxy_host: string;
  suspend_timeout_seconds: number;
  provisioner: 'k8s-pod' | 'k8s-neonvm';
}

export interface NeonDatabase {
  id: number;
  branch_id: string;
  name: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface NeonRole {
  branch_id: string;
  name: string;
  protected: boolean;
  created_at: string;
  updated_at: string;
}

export interface NeonOperation {
  id: string;
  project_id: string;
  branch_id: string | null;
  endpoint_id: string | null;
  action: string;
  status: 'scheduling' | 'running' | 'finished' | 'failed' | 'cancelling' | 'cancelled' | 'skipped';
  failures_count: number;
  created_at: string;
  updated_at: string;
  total_duration_ms: number;
}

export interface NeonConsumption {
  period_id: string;
  period_start: string;
  period_end: string;
  active_time_seconds: number;
  compute_time_seconds: number;
  written_data_bytes: number;
  data_transfer_bytes: number;
  data_storage_bytes_hour: number;
}

export interface NeonProjectQuota {
  active_time_seconds: number;
  compute_time_seconds: number;
  written_data_bytes: number;
  data_transfer_bytes: number;
  logical_size_bytes: number;
}

export class NeonClient {
  private baseUrl = 'https://console.neon.tech/api/v2';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Neon API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Projects
  async listProjects(): Promise<{ projects: NeonProject[] }> {
    return this.request<{ projects: NeonProject[] }>('/projects');
  }

  async getProject(projectId: string): Promise<{ project: NeonProject }> {
    return this.request<{ project: NeonProject }>(`/projects/${projectId}`);
  }

  async createProject(options: {
    name: string;
    region_id?: string;
    pg_version?: number;
  }): Promise<{ project: NeonProject; branch: NeonBranch; endpoints: NeonEndpoint[] }> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify({ project: options }),
    });
  }

  async deleteProject(projectId: string): Promise<{ project: NeonProject }> {
    return this.request(`/projects/${projectId}`, { method: 'DELETE' });
  }

  // Branches
  async listBranches(projectId: string): Promise<{ branches: NeonBranch[] }> {
    return this.request<{ branches: NeonBranch[] }>(`/projects/${projectId}/branches`);
  }

  async getBranch(projectId: string, branchId: string): Promise<{ branch: NeonBranch }> {
    return this.request<{ branch: NeonBranch }>(`/projects/${projectId}/branches/${branchId}`);
  }

  async createBranch(projectId: string, options: {
    name?: string;
    parent_id?: string;
    endpoints?: Array<{ type: 'read_only' | 'read_write' }>;
  }): Promise<{ branch: NeonBranch; endpoints: NeonEndpoint[] }> {
    return this.request(`/projects/${projectId}/branches`, {
      method: 'POST',
      body: JSON.stringify({ branch: options }),
    });
  }

  async deleteBranch(projectId: string, branchId: string): Promise<{ branch: NeonBranch }> {
    return this.request(`/projects/${projectId}/branches/${branchId}`, { method: 'DELETE' });
  }

  async resetBranch(projectId: string, branchId: string, parentId: string): Promise<{ branch: NeonBranch }> {
    return this.request(`/projects/${projectId}/branches/${branchId}/reset`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: parentId }),
    });
  }

  // Endpoints (Compute)
  async listEndpoints(projectId: string): Promise<{ endpoints: NeonEndpoint[] }> {
    return this.request<{ endpoints: NeonEndpoint[] }>(`/projects/${projectId}/endpoints`);
  }

  async getEndpoint(projectId: string, endpointId: string): Promise<{ endpoint: NeonEndpoint }> {
    return this.request<{ endpoint: NeonEndpoint }>(`/projects/${projectId}/endpoints/${endpointId}`);
  }

  async startEndpoint(projectId: string, endpointId: string): Promise<{ endpoint: NeonEndpoint }> {
    return this.request(`/projects/${projectId}/endpoints/${endpointId}/start`, { method: 'POST' });
  }

  async suspendEndpoint(projectId: string, endpointId: string): Promise<{ endpoint: NeonEndpoint }> {
    return this.request(`/projects/${projectId}/endpoints/${endpointId}/suspend`, { method: 'POST' });
  }

  // Databases
  async listDatabases(projectId: string, branchId: string): Promise<{ databases: NeonDatabase[] }> {
    return this.request<{ databases: NeonDatabase[] }>(`/projects/${projectId}/branches/${branchId}/databases`);
  }

  async createDatabase(projectId: string, branchId: string, options: {
    name: string;
    owner_name: string;
  }): Promise<{ database: NeonDatabase }> {
    return this.request(`/projects/${projectId}/branches/${branchId}/databases`, {
      method: 'POST',
      body: JSON.stringify({ database: options }),
    });
  }

  async deleteDatabase(projectId: string, branchId: string, databaseName: string): Promise<{ database: NeonDatabase }> {
    return this.request(`/projects/${projectId}/branches/${branchId}/databases/${databaseName}`, { method: 'DELETE' });
  }

  // Roles
  async listRoles(projectId: string, branchId: string): Promise<{ roles: NeonRole[] }> {
    return this.request<{ roles: NeonRole[] }>(`/projects/${projectId}/branches/${branchId}/roles`);
  }

  async createRole(projectId: string, branchId: string, name: string): Promise<{ role: NeonRole }> {
    return this.request(`/projects/${projectId}/branches/${branchId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role: { name } }),
    });
  }

  async deleteRole(projectId: string, branchId: string, roleName: string): Promise<{ role: NeonRole }> {
    return this.request(`/projects/${projectId}/branches/${branchId}/roles/${roleName}`, { method: 'DELETE' });
  }

  async getConnectionUri(projectId: string, _branchId: string, roleName: string, databaseName: string): Promise<{ uri: string }> {
    const params = new URLSearchParams({
      role_name: roleName,
      database_name: databaseName,
    });
    return this.request<{ uri: string }>(`/projects/${projectId}/connection_uri?${params}`);
  }

  // Operations
  async listOperations(projectId: string, options?: {
    limit?: number;
  }): Promise<{ operations: NeonOperation[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    return this.request<{ operations: NeonOperation[] }>(`/projects/${projectId}/operations?${params}`);
  }

  // Consumption / Usage
  async getConsumption(options?: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<{ periods: NeonConsumption[] }> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    if (options?.limit) params.set('limit', options.limit.toString());
    return this.request<{ periods: NeonConsumption[] }>(`/consumption/projects?${params}`);
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
export class NeonService {
  private client: NeonClient;

  constructor() {
    this.client = new NeonClient(
      process.env.NEON_API_KEY || ''
    );
  }

  async getProjects() {
    const { projects } = await this.client.listProjects();
    return projects;
  }

  async getProject(projectId: string) {
    const { project } = await this.client.getProject(projectId);
    return project;
  }

  async getBranches(projectId: string) {
    const { branches } = await this.client.listBranches(projectId);
    return branches;
  }

  async getEndpoints(projectId: string) {
    const { endpoints } = await this.client.listEndpoints(projectId);
    return endpoints;
  }

  async getDatabases(projectId: string, branchId: string) {
    const { databases } = await this.client.listDatabases(projectId, branchId);
    return databases;
  }

  async getOperations(projectId: string) {
    const { operations } = await this.client.listOperations(projectId, { limit: 50 });
    return operations;
  }

  async getDashboardStats() {
    const { projects } = await this.client.listProjects();

    // Aggregate metrics across all projects
    let totalBranches = 0;
    let totalEndpoints = 0;
    let totalDatabases = 0;
    let activeEndpoints = 0;
    let idleEndpoints = 0;
    let totalStorageBytes = 0;
    let totalComputeSeconds = 0;
    let totalWrittenBytes = 0;
    let totalTransferBytes = 0;

    const projectDetails = await Promise.all(
      projects.map(async (project) => {
        const [branchesRes, endpointsRes] = await Promise.all([
          this.client.listBranches(project.id).catch(() => ({ branches: [] })),
          this.client.listEndpoints(project.id).catch(() => ({ endpoints: [] })),
        ]);

        const branches = branchesRes.branches;
        const endpoints = endpointsRes.endpoints;

        // Get databases from primary branch
        const primaryBranch = branches.find(b => b.primary);
        let databases: NeonDatabase[] = [];
        if (primaryBranch) {
          const dbRes = await this.client.listDatabases(project.id, primaryBranch.id).catch(() => ({ databases: [] }));
          databases = dbRes.databases;
        }

        totalBranches += branches.length;
        totalEndpoints += endpoints.length;
        totalDatabases += databases.length;
        activeEndpoints += endpoints.filter(e => e.current_state === 'active').length;
        idleEndpoints += endpoints.filter(e => e.current_state === 'idle').length;
        totalStorageBytes += branches.reduce((sum, b) => sum + b.logical_size, 0);
        totalComputeSeconds += project.compute_time_seconds;
        totalWrittenBytes += project.written_data_bytes;
        totalTransferBytes += project.data_transfer_bytes;

        return {
          id: project.id,
          name: project.name,
          region: project.region_id,
          pgVersion: project.pg_version,
          branchCount: branches.length,
          endpointCount: endpoints.length,
          databaseCount: databases.length,
          activeEndpoints: endpoints.filter(e => e.current_state === 'active').length,
          storageBytes: branches.reduce((sum, b) => sum + b.logical_size, 0),
          computeSeconds: project.compute_time_seconds,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        };
      })
    );

    // Get recent consumption if available
    let consumption: NeonConsumption[] = [];
    try {
      const consumptionRes = await this.client.getConsumption({ limit: 7 });
      consumption = consumptionRes.periods;
    } catch {
      // Consumption API may not be available for all plans
    }

    return {
      // Project counts
      totalProjects: projects.length,
      
      // Resource counts
      totalBranches,
      totalEndpoints,
      totalDatabases,
      activeEndpoints,
      idleEndpoints,
      
      // Usage metrics
      totalStorageBytes,
      totalStorageMB: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100,
      totalComputeSeconds,
      totalComputeHours: Math.round(totalComputeSeconds / 3600 * 100) / 100,
      totalWrittenBytes,
      totalWrittenMB: Math.round(totalWrittenBytes / (1024 * 1024) * 100) / 100,
      totalTransferBytes,
      totalTransferMB: Math.round(totalTransferBytes / (1024 * 1024) * 100) / 100,
      
      // Project breakdown
      projects: projectDetails,
      
      // Recent consumption
      recentConsumption: consumption,
      
      // Regions in use
      regions: [...new Set(projects.map(p => p.region_id))],
      
      // PostgreSQL versions in use
      pgVersions: [...new Set(projects.map(p => p.pg_version))],
    };
  }

  // Actions
  async createProject(name: string, options?: { region?: string; pgVersion?: number }) {
    return this.client.createProject({
      name,
      region_id: options?.region,
      pg_version: options?.pgVersion,
    });
  }

  async deleteProject(projectId: string) {
    return this.client.deleteProject(projectId);
  }

  async createBranch(projectId: string, name?: string, parentId?: string) {
    return this.client.createBranch(projectId, {
      name,
      parent_id: parentId,
      endpoints: [{ type: 'read_write' }],
    });
  }

  async deleteBranch(projectId: string, branchId: string) {
    return this.client.deleteBranch(projectId, branchId);
  }

  async startEndpoint(projectId: string, endpointId: string) {
    return this.client.startEndpoint(projectId, endpointId);
  }

  async suspendEndpoint(projectId: string, endpointId: string) {
    return this.client.suspendEndpoint(projectId, endpointId);
  }

  async getConnectionString(projectId: string, branchId: string, roleName: string, databaseName: string) {
    return this.client.getConnectionUri(projectId, branchId, roleName, databaseName);
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const neonService = new NeonService();

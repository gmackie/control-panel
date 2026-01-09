/**
 * Turso Platform API Client
 * Monitor distributed SQLite databases, groups, organizations, and usage metrics
 * API Docs: https://docs.turso.tech/api-reference
 */

// Organization types
export interface TursoOrganization {
  slug: string;
  name: string;
  type: 'personal' | 'team';
  overages: boolean;
  blocked_reads: boolean;
  blocked_writes: boolean;
}

// Database types
export interface TursoDatabase {
  Name: string;
  DbId: string;
  Hostname: string;
  group: string;
  primaryRegion: string;
  regions: string[];
  version?: string;
  type?: string;
  archived?: boolean;
  block_reads: boolean;
  block_writes: boolean;
  delete_protection?: boolean;
  sleeping?: boolean;
}

// Group types
export interface TursoGroup {
  name: string;
  primary: string;
  locations: string[];
  archived: boolean;
  version?: string;
}

// Instance types (replicas)
export interface TursoInstance {
  uuid: string;
  name: string;
  type: 'primary' | 'replica';
  region: string;
  hostname: string;
}

// Usage types
export interface TursoOrganizationUsage {
  uuid: string;
  instances: TursoInstanceUsage[];
  total: TursoUsageMetrics;
}

export interface TursoInstanceUsage {
  uuid: string;
  usage: TursoUsageMetrics;
}

export interface TursoUsageMetrics {
  rows_read: number;
  rows_written: number;
  storage_bytes: number;
  bytes_synced?: number;
}

export interface TursoDatabaseUsage {
  database: {
    uuid: string;
    instances: Array<{
      uuid: string;
      usage: TursoUsageMetrics;
    }>;
    total: TursoUsageMetrics;
  };
}

// Billing usage (organization level)
export interface TursoBillingUsage {
  startTime?: string;
  endTime?: string;
  databases?: {
    count: number;
    storageBytes: number;
    transferBytes: number;
  };
  organization?: {
    uuid: string;
    usage: {
      rows_read: number;
      rows_written: number;
      storage_bytes: number;
      bytes_synced: number;
    };
  };
}

// Stats types
export interface TursoDatabaseStats {
  top_queries: Array<{
    query: string;
    rows_read: number;
    rows_written: number;
  }>;
}

export class TursoClient {
  private baseUrl = 'https://api.turso.tech';
  private apiKey: string;
  private defaultOrganization?: string;

  constructor(apiKey: string, organization?: string) {
    this.apiKey = apiKey;
    this.defaultOrganization = organization;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Turso API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Organizations
  async listOrganizations(): Promise<TursoOrganization[]> {
    // The API returns an array directly, not wrapped in an object
    return this.request<TursoOrganization[]>('/v1/organizations');
  }

  async getOrganization(orgSlug: string): Promise<{ organization: TursoOrganization }> {
    return this.request<{ organization: TursoOrganization }>(`/v1/organizations/${orgSlug}`);
  }

  // Databases
  async listDatabases(orgSlug?: string): Promise<{ databases: TursoDatabase[] }> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<{ databases: TursoDatabase[] }>(`/v1/organizations/${org}/databases`);
  }

  async getDatabase(databaseName: string, orgSlug?: string): Promise<{ database: TursoDatabase }> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<{ database: TursoDatabase }>(`/v1/organizations/${org}/databases/${databaseName}`);
  }

  async getDatabaseUsage(
    databaseName: string,
    orgSlug?: string,
    options?: { from?: string; to?: string }
  ): Promise<TursoDatabaseUsage> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<TursoDatabaseUsage>(`/v1/organizations/${org}/databases/${databaseName}/usage${queryString}`);
  }

  async getDatabaseStats(databaseName: string, orgSlug?: string): Promise<TursoDatabaseStats> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<TursoDatabaseStats>(`/v1/organizations/${org}/databases/${databaseName}/stats`);
  }

  // Instances (replicas)
  async listInstances(databaseName: string, orgSlug?: string): Promise<{ instances: TursoInstance[] }> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<{ instances: TursoInstance[] }>(`/v1/organizations/${org}/databases/${databaseName}/instances`);
  }

  // Groups
  async listGroups(orgSlug?: string): Promise<{ groups: TursoGroup[] }> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<{ groups: TursoGroup[] }>(`/v1/organizations/${org}/groups`);
  }

  async getGroup(groupName: string, orgSlug?: string): Promise<{ group: TursoGroup }> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<{ group: TursoGroup }>(`/v1/organizations/${org}/groups/${groupName}`);
  }

  // Organization Usage (billing cycle)
  async getOrganizationUsage(orgSlug?: string): Promise<TursoBillingUsage> {
    const org = orgSlug || this.defaultOrganization;
    if (!org) throw new Error('Organization slug is required');
    return this.request<TursoBillingUsage>(`/v1/organizations/${org}/usage`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.listOrganizations();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer for common operations
export class TursoService {
  private client: TursoClient;

  constructor(apiKey?: string, organization?: string) {
    this.client = new TursoClient(
      apiKey || process.env.TURSO_API_TOKEN || '',
      organization
    );
  }

  async getOrganizations() {
    return this.client.listOrganizations();
  }

  async getDatabases(orgSlug: string) {
    const { databases } = await this.client.listDatabases(orgSlug);
    return databases;
  }

  async getGroups(orgSlug: string) {
    const { groups } = await this.client.listGroups(orgSlug);
    return groups;
  }

  async getUsage(orgSlug: string) {
    return this.client.getOrganizationUsage(orgSlug);
  }

  async getInstances(orgSlug: string, databaseName: string) {
    const { instances } = await this.client.listInstances(databaseName, orgSlug);
    return instances;
  }

  async getDashboardStats() {
    const organizations = await this.client.listOrganizations();

    let totalDatabases = 0;
    let totalGroups = 0;
    let totalInstances = 0;
    let totalStorageBytes = 0;
    let totalRowsRead = 0;
    let totalRowsWritten = 0;
    const allRegions = new Set<string>();

    const orgDetails = await Promise.all(
      organizations.map(async (org) => {
        const [databasesRes, groupsRes, usageRes] = await Promise.all([
          this.client.listDatabases(org.slug).catch(() => ({ databases: [] })),
          this.client.listGroups(org.slug).catch(() => ({ groups: [] })),
          this.client.getOrganizationUsage(org.slug).catch(() => null),
        ]);

        const databases = databasesRes.databases;
        const groups = groupsRes.groups;

        // Collect all regions from groups
        groups.forEach(g => g.locations.forEach(loc => allRegions.add(loc)));
        databases.forEach(d => d.regions?.forEach(r => allRegions.add(r)));

        // Get instance counts for each database
        let orgInstanceCount = 0;
        const databaseDetails = await Promise.all(
          databases.slice(0, 10).map(async (db) => { // Limit to first 10 to avoid rate limiting
            try {
              const { instances } = await this.client.listInstances(db.Name, org.slug);
              orgInstanceCount += instances.length;
              return {
                name: db.Name,
                dbId: db.DbId,
                hostname: db.Hostname,
                group: db.group,
                primaryRegion: db.primaryRegion,
                regions: db.regions,
                blockReads: db.block_reads,
                blockWrites: db.block_writes,
                sleeping: db.sleeping,
                instanceCount: instances.length,
              };
            } catch {
              return {
                name: db.Name,
                dbId: db.DbId,
                hostname: db.Hostname,
                group: db.group,
                primaryRegion: db.primaryRegion,
                regions: db.regions,
                blockReads: db.block_reads,
                blockWrites: db.block_writes,
                sleeping: db.sleeping,
                instanceCount: db.regions?.length || 1,
              };
            }
          })
        );

        totalDatabases += databases.length;
        totalGroups += groups.length;
        totalInstances += orgInstanceCount;

        // Extract usage metrics if available
        let orgStorageBytes = 0;
        let orgRowsRead = 0;
        let orgRowsWritten = 0;

        if (usageRes?.organization?.usage) {
          orgStorageBytes = usageRes.organization.usage.storage_bytes || 0;
          orgRowsRead = usageRes.organization.usage.rows_read || 0;
          orgRowsWritten = usageRes.organization.usage.rows_written || 0;
        } else if (usageRes?.databases) {
          orgStorageBytes = usageRes.databases.storageBytes || 0;
        }

        totalStorageBytes += orgStorageBytes;
        totalRowsRead += orgRowsRead;
        totalRowsWritten += orgRowsWritten;

        return {
          slug: org.slug,
          name: org.name,
          type: org.type,
          overages: org.overages,
          blockedReads: org.blocked_reads,
          blockedWrites: org.blocked_writes,
          databaseCount: databases.length,
          groupCount: groups.length,
          instanceCount: orgInstanceCount,
          storageBytes: orgStorageBytes,
          rowsRead: orgRowsRead,
          rowsWritten: orgRowsWritten,
          databases: databaseDetails,
          groups: groups.map(g => ({
            name: g.name,
            primary: g.primary,
            locations: g.locations,
            archived: g.archived,
          })),
        };
      })
    );

    return {
      // Organization counts
      totalOrganizations: organizations.length,
      
      // Resource counts
      totalDatabases,
      totalGroups,
      totalInstances,
      
      // Regions in use
      regions: Array.from(allRegions),
      
      // Usage metrics
      totalStorageBytes,
      totalStorageMB: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100,
      totalStorageGB: Math.round(totalStorageBytes / (1024 * 1024 * 1024) * 100) / 100,
      totalRowsRead,
      totalRowsWritten,
      
      // Organization breakdown
      organizations: orgDetails,
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const tursoService = new TursoService();

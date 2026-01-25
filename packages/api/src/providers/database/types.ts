import type { Timestamps, PaginationOptions, PaginatedResponse } from '../types';

export type DatabaseProviderType = 'neon' | 'turso' | 'supabase' | 'planetscale';

export type DatabaseStatus = 'creating' | 'ready' | 'error' | 'deleting' | 'suspended';

export interface Database extends Timestamps {
  id: string;
  name: string;
  status: DatabaseStatus;
  region: string;
  size: string | null;
  connectionString: string;
  host: string;
  port: number;
  username: string;
  databaseName: string;
}

export interface DatabaseBranch {
  id: string;
  name: string;
  parentId: string | null;
  primary: boolean;
  createdAt: Date;
}

export interface DatabaseProject {
  id: string;
  name: string;
  region: string;
  createdAt: Date;
  databases: Database[];
  branches?: DatabaseBranch[];
}

export interface CreateDatabaseOptions {
  name: string;
  region?: string;
  projectId?: string;
}

export interface CreateBranchOptions {
  name: string;
  parentBranchId?: string;
}

export interface ConnectionStringOptions {
  pooled?: boolean;
  ssl?: boolean;
  branch?: string;
}

export interface ListDatabasesOptions extends PaginationOptions {
  projectId?: string;
}

export interface DatabaseMetrics {
  connectionCount: number;
  storageBytes: number;
  computeSeconds: number;
  dataTransferBytes: number;
}

export type ListDatabasesResponse = PaginatedResponse<Database>;

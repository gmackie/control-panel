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
  DatabaseProviderType,
} from './types';

export * from './types';

export interface DatabaseProvider {
  readonly type: DatabaseProviderType;

  listProjects(): Promise<DatabaseProject[]>;
  
  getProject(projectId: string): Promise<DatabaseProject>;
  
  createProject(name: string, region?: string): Promise<DatabaseProject>;
  
  deleteProject(projectId: string): Promise<void>;

  listDatabases(options?: ListDatabasesOptions): Promise<ListDatabasesResponse>;
  
  getDatabase(databaseId: string): Promise<Database>;
  
  createDatabase(options: CreateDatabaseOptions): Promise<Database>;
  
  deleteDatabase(databaseId: string): Promise<void>;

  getConnectionString(
    databaseId: string,
    options?: ConnectionStringOptions
  ): Promise<string>;

  listBranches(projectId: string): Promise<DatabaseBranch[]>;
  
  getBranch(projectId: string, branchId: string): Promise<DatabaseBranch>;
  
  createBranch(
    projectId: string,
    options: CreateBranchOptions
  ): Promise<DatabaseBranch>;
  
  deleteBranch(projectId: string, branchId: string): Promise<void>;

  getMetrics(databaseId: string): Promise<DatabaseMetrics>;
}

export interface DatabaseProviderConfig {
  type: DatabaseProviderType;
  apiKey: string;
  baseUrl?: string;
}

export function isDatabaseProvider(obj: unknown): obj is DatabaseProvider {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'createDatabase' in obj &&
    'getConnectionString' in obj
  );
}

export { NeonProvider, createNeonProvider } from './adapters/neon';

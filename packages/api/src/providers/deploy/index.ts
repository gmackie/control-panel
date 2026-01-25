import type { EnvVar, Environment } from '../types';
import type {
  Deployment,
  DeploymentProject,
  DeployOptions,
  RollbackOptions,
  CreateProjectOptions,
  LinkGitRepoOptions,
  ListDeploymentsOptions,
  ListDeploymentsResponse,
  LogEntry,
  LogStreamOptions,
  DeployProviderType,
} from './types';

export * from './types';
export { VercelProvider, createVercelProvider } from './adapters/vercel';
export { KubernetesProvider, createKubernetesProvider } from './adapters/kubernetes';

export interface DeploymentProvider {
  readonly type: DeployProviderType;

  listProjects(): Promise<DeploymentProject[]>;
  
  getProject(projectId: string): Promise<DeploymentProject>;
  
  getProjectByName(name: string): Promise<DeploymentProject | null>;
  
  createProject(options: CreateProjectOptions): Promise<DeploymentProject>;
  
  deleteProject(projectId: string): Promise<void>;

  linkGitRepo(projectId: string, options: LinkGitRepoOptions): Promise<void>;
  
  unlinkGitRepo(projectId: string): Promise<void>;

  deploy(projectId: string, options?: DeployOptions): Promise<Deployment>;
  
  getDeployment(deploymentId: string): Promise<Deployment>;
  
  listDeployments(
    projectId: string,
    options?: ListDeploymentsOptions
  ): Promise<ListDeploymentsResponse>;
  
  cancelDeployment(deploymentId: string): Promise<void>;
  
  rollback(projectId: string, options: RollbackOptions): Promise<Deployment>;

  getLogs(deploymentId: string, options?: LogStreamOptions): AsyncIterable<LogEntry>;
  
  getBuildLogs(deploymentId: string): Promise<LogEntry[]>;

  getEnvVars(projectId: string, environment?: Environment): Promise<EnvVar[]>;
  
  setEnvVars(
    projectId: string,
    envVars: EnvVar[],
    environment?: Environment
  ): Promise<void>;
  
  deleteEnvVar(
    projectId: string,
    key: string,
    environment?: Environment
  ): Promise<void>;

  getDomains(projectId: string): Promise<string[]>;
  
  addDomain(projectId: string, domain: string): Promise<void>;
  
  removeDomain(projectId: string, domain: string): Promise<void>;
}

export interface DeployProviderConfig {
  type: DeployProviderType;
  token: string;
  teamId?: string;
  baseUrl?: string;
}

export function isDeploymentProvider(obj: unknown): obj is DeploymentProvider {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'deploy' in obj &&
    'getDeployment' in obj &&
    'listDeployments' in obj
  );
}

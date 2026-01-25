import type { Actor, Environment, EnvVar, Timestamps, PaginationOptions, PaginatedResponse } from '../types';

export type DeployProviderType = 'vercel' | 'kubernetes' | 'railway' | 'flyio';

export type DeploymentStatus = 
  | 'queued'
  | 'building'
  | 'deploying'
  | 'ready'
  | 'error'
  | 'cancelled';

export interface Deployment extends Timestamps {
  id: string;
  name: string;
  status: DeploymentStatus;
  environment: Environment;
  url: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  triggeredBy: Actor | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface DeploymentProject {
  id: string;
  name: string;
  slug: string;
  framework: string | null;
  gitRepo: {
    owner: string;
    name: string;
    url: string;
  } | null;
  domains: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface DeployOptions {
  branch?: string;
  commitSha?: string;
  environment?: Environment;
  force?: boolean;
}

export interface RollbackOptions {
  targetDeploymentId: string;
}

export interface CreateProjectOptions {
  name: string;
  framework?: string;
  gitRepo?: {
    owner: string;
    name: string;
    provider: 'github' | 'gitea' | 'gitlab';
  };
  envVars?: EnvVar[];
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  rootDirectory?: string;
}

export interface LinkGitRepoOptions {
  owner: string;
  name: string;
  provider: 'github' | 'gitea' | 'gitlab';
  productionBranch?: string;
}

export interface ListDeploymentsOptions extends PaginationOptions {
  environment?: Environment;
  status?: DeploymentStatus;
  branch?: string;
  since?: Date;
  until?: Date;
}

export interface LogStreamOptions {
  follow?: boolean;
  since?: Date;
  tail?: number;
}

export type ListDeploymentsResponse = PaginatedResponse<Deployment>;

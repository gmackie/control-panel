import type { GitProvider } from './git';
import type { DeploymentProvider } from './deploy';
import type { DatabaseProvider } from './database';
import type { GitProviderType } from './git/types';
import type { DeployProviderType } from './deploy/types';
import type { DatabaseProviderType } from './database/types';

import { GitHubProvider } from './git/adapters/github';
import { GiteaProvider } from './git/adapters/gitea';
import { VercelProvider } from './deploy/adapters/vercel';
import { KubernetesProvider } from './deploy/adapters/kubernetes';
import { NeonProvider } from './database/adapters/neon';

export interface ProviderConfigs {
  git: {
    github?: { token: string };
    gitea?: { baseUrl: string; token: string };
    gitlab?: { baseUrl?: string; token: string };
  };
  deploy: {
    vercel?: { token: string; teamId?: string };
    kubernetes?: { apiUrl: string; token: string; namespace?: string; skipTlsVerify?: boolean };
    railway?: { token: string };
    flyio?: { token: string };
  };
  database: {
    neon?: { apiKey: string };
    turso?: { token: string; organizationSlug: string };
    supabase?: { token: string };
    planetscale?: { token: string; organizationId: string };
  };
}

export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;

  private gitProviders = new Map<GitProviderType, GitProvider>();
  private deployProviders = new Map<DeployProviderType, DeploymentProvider>();
  private dbProviders = new Map<DatabaseProviderType, DatabaseProvider>();

  private configs: ProviderConfigs = { git: {}, deploy: {}, database: {} };

  private constructor() {}

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  static reset(): void {
    ProviderRegistry.instance = null;
  }

  configure(configs: Partial<ProviderConfigs>): void {
    if (configs.git) {
      this.configs.git = { ...this.configs.git, ...configs.git };
    }
    if (configs.deploy) {
      this.configs.deploy = { ...this.configs.deploy, ...configs.deploy };
    }
    if (configs.database) {
      this.configs.database = { ...this.configs.database, ...configs.database };
    }
  }

  configureFromEnv(): void {
    if (process.env.GITHUB_TOKEN) {
      this.configs.git.github = { token: process.env.GITHUB_TOKEN };
    }
    if (process.env.GITEA_URL && process.env.GITEA_TOKEN) {
      this.configs.git.gitea = {
        baseUrl: process.env.GITEA_URL,
        token: process.env.GITEA_TOKEN,
      };
    }
    if (process.env.VERCEL_TOKEN) {
      this.configs.deploy.vercel = {
        token: process.env.VERCEL_TOKEN,
        teamId: process.env.VERCEL_TEAM_ID,
      };
    }
    if (process.env.K3S_SA_TOKEN && process.env.K8S_API_URL) {
      this.configs.deploy.kubernetes = {
        apiUrl: process.env.K8S_API_URL,
        token: process.env.K3S_SA_TOKEN,
        skipTlsVerify: process.env.K8S_SKIP_TLS_VERIFY === 'true',
      };
    }
    if (process.env.NEON_API_KEY) {
      this.configs.database.neon = { apiKey: process.env.NEON_API_KEY };
    }
  }

  registerGitProvider(type: GitProviderType, provider: GitProvider): void {
    this.gitProviders.set(type, provider);
  }

  registerDeployProvider(type: DeployProviderType, provider: DeploymentProvider): void {
    this.deployProviders.set(type, provider);
  }

  registerDbProvider(type: DatabaseProviderType, provider: DatabaseProvider): void {
    this.dbProviders.set(type, provider);
  }

  getGitProvider(type: GitProviderType = 'github'): GitProvider {
    const cached = this.gitProviders.get(type);
    if (cached) return cached;

    const provider = this.createGitProvider(type);
    this.gitProviders.set(type, provider);
    return provider;
  }

  getDeployProvider(type: DeployProviderType = 'vercel'): DeploymentProvider {
    const cached = this.deployProviders.get(type);
    if (cached) return cached;

    const provider = this.createDeployProvider(type);
    this.deployProviders.set(type, provider);
    return provider;
  }

  getDbProvider(type: DatabaseProviderType = 'neon'): DatabaseProvider {
    const cached = this.dbProviders.get(type);
    if (cached) return cached;

    const provider = this.createDbProvider(type);
    this.dbProviders.set(type, provider);
    return provider;
  }

  hasGitProvider(type: GitProviderType): boolean {
    return this.gitProviders.has(type) || this.hasGitConfig(type);
  }

  hasDeployProvider(type: DeployProviderType): boolean {
    return this.deployProviders.has(type) || this.hasDeployConfig(type);
  }

  hasDbProvider(type: DatabaseProviderType): boolean {
    return this.dbProviders.has(type) || this.hasDbConfig(type);
  }

  getAvailableGitProviders(): GitProviderType[] {
    const types: GitProviderType[] = ['github', 'gitea', 'gitlab'];
    return types.filter(t => this.hasGitProvider(t));
  }

  getAvailableDeployProviders(): DeployProviderType[] {
    const types: DeployProviderType[] = ['vercel', 'kubernetes', 'railway', 'flyio'];
    return types.filter(t => this.hasDeployProvider(t));
  }

  getAvailableDbProviders(): DatabaseProviderType[] {
    const types: DatabaseProviderType[] = ['neon', 'turso', 'supabase', 'planetscale'];
    return types.filter(t => this.hasDbProvider(t));
  }

  private hasGitConfig(type: GitProviderType): boolean {
    const config = this.configs.git[type];
    return config !== undefined && 'token' in config;
  }

  private hasDeployConfig(type: DeployProviderType): boolean {
    const config = this.configs.deploy[type];
    if (!config) return false;
    if (type === 'kubernetes') {
      return 'apiUrl' in config && 'token' in config;
    }
    return 'token' in config;
  }

  private hasDbConfig(type: DatabaseProviderType): boolean {
    switch (type) {
      case 'neon':
        return this.configs.database.neon?.apiKey !== undefined;
      case 'turso':
        return this.configs.database.turso?.token !== undefined;
      case 'supabase':
        return this.configs.database.supabase?.token !== undefined;
      case 'planetscale':
        return this.configs.database.planetscale?.token !== undefined;
      default:
        return false;
    }
  }

  private createGitProvider(type: GitProviderType): GitProvider {
    switch (type) {
      case 'github': {
        const config = this.configs.git.github;
        if (!config?.token) {
          throw new Error('GitHub provider not configured. Set GITHUB_TOKEN or call configure().');
        }
        return new GitHubProvider({ type: 'github', token: config.token });
      }
      case 'gitea': {
        const config = this.configs.git.gitea;
        if (!config?.baseUrl || !config?.token) {
          throw new Error('Gitea provider not configured. Set GITEA_URL and GITEA_TOKEN or call configure().');
        }
        return new GiteaProvider({ type: 'gitea', baseUrl: config.baseUrl, token: config.token });
      }
      case 'gitlab': {
        throw new Error('GitLab provider not yet implemented.');
      }
      default:
        throw new Error(`Unknown git provider type: ${type}`);
    }
  }

  private createDeployProvider(type: DeployProviderType): DeploymentProvider {
    switch (type) {
      case 'vercel': {
        const config = this.configs.deploy.vercel;
        if (!config?.token) {
          throw new Error('Vercel provider not configured. Set VERCEL_TOKEN or call configure().');
        }
        return new VercelProvider({ token: config.token, teamId: config.teamId });
      }
      case 'kubernetes': {
        const config = this.configs.deploy.kubernetes;
        if (!config?.apiUrl || !config?.token) {
          throw new Error('Kubernetes provider not configured. Set K8S_API_URL and K3S_SA_TOKEN or call configure().');
        }
        return new KubernetesProvider({
          apiUrl: config.apiUrl,
          token: config.token,
          namespace: config.namespace,
          skipTlsVerify: config.skipTlsVerify,
        });
      }
      case 'railway':
      case 'flyio':
        throw new Error(`${type} provider not yet implemented.`);
      default:
        throw new Error(`Unknown deploy provider type: ${type}`);
    }
  }

  private createDbProvider(type: DatabaseProviderType): DatabaseProvider {
    switch (type) {
      case 'neon': {
        const config = this.configs.database.neon;
        if (!config?.apiKey) {
          throw new Error('Neon provider not configured. Set NEON_API_KEY or call configure().');
        }
        return new NeonProvider({ apiKey: config.apiKey });
      }
      case 'turso': {
        const config = this.configs.database.turso;
        if (!config?.token) {
          throw new Error('Turso provider not configured. Set TURSO_TOKEN or call configure().');
        }
        throw new Error('Turso provider not yet implemented.');
      }
      case 'supabase':
      case 'planetscale':
        throw new Error(`${type} provider not yet implemented.`);
      default:
        throw new Error(`Unknown database provider type: ${type}`);
    }
  }
}

export function getProviderRegistry(): ProviderRegistry {
  const registry = ProviderRegistry.getInstance();
  registry.configureFromEnv();
  return registry;
}

export function getGitProvider(type?: GitProviderType): GitProvider {
  return getProviderRegistry().getGitProvider(type);
}

export function getDeployProvider(type?: DeployProviderType): DeploymentProvider {
  return getProviderRegistry().getDeployProvider(type);
}

export function getDbProvider(type?: DatabaseProviderType): DatabaseProvider {
  return getProviderRegistry().getDbProvider(type);
}

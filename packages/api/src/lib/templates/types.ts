export interface TemplateConfig {
  name: string;
  version: string;
  description: string;
  author?: string;
  repository: string;
  features: {
    web: boolean;
    mobile: boolean;
    api: boolean;
  };
  supportedProviders: {
    git: GitProviderType[];
    deploy: DeployProviderType[];
    database: DbProviderType[];
  };
  defaultIntegrations: string[];
  optionalIntegrations: string[];
}

export type GitProviderType = 'github' | 'gitea' | 'gitlab';
export type DeployProviderType = 'vercel' | 'kubernetes' | 'railway' | 'flyio';
export type DbProviderType = 'neon' | 'turso' | 'supabase' | 'planetscale';

export interface PlaceholderDefinition {
  description: string;
  example: string;
  validation?: string;
  files: string[];
  derived?: {
    from: string;
    transform: string;
  };
  providedBy?: 'user' | 'control_panel';
}

export interface PlaceholdersConfig {
  placeholders: Record<string, PlaceholderDefinition>;
}

export interface IntegrationEnvVar {
  description: string;
  pattern?: string;
}

export interface IntegrationModule {
  id: string;
  name: string;
  description: string;
  category: 'auth' | 'payments' | 'analytics' | 'monitoring' | 'database' | 'storage' | 'other';
  documentation?: string;
  package?: {
    path: string;
    dependencies: Record<string, string>;
  };
  envVars: {
    required?: Record<string, IntegrationEnvVar>;
    public?: Record<string, IntegrationEnvVar>;
  };
  files: {
    include: string[];
    excludeWithout?: string[];
  };
  setup: {
    manual?: string[];
    automated?: {
      supported: boolean;
      reason?: string;
    };
  };
  controlPanelIntegration?: {
    provider: string;
    syncMetrics?: boolean;
    webhookEvents?: string[];
  };
}

export interface TemplateMetadata {
  config: TemplateConfig;
  placeholders: PlaceholdersConfig;
  integrations: IntegrationModule[];
}

export interface InstantiateTemplateInput {
  templateId: string;
  appName: string;
  appSlug: string;
  description?: string;
  modules: string[];
  gitProvider: GitProviderType;
  deployProvider: DeployProviderType;
  dbProvider: DbProviderType;
  repoVisibility?: 'public' | 'private';
  autoProvision?: boolean;
}

export interface InstantiateTemplateResult {
  success: boolean;
  applicationId: string;
  repositoryUrl: string;
  provisioningStatus: ProvisioningStepResult[];
  nextSteps: string[];
}

export interface ProvisioningStepResult {
  step: string;
  provider: string;
  status: 'success' | 'failed' | 'skipped' | 'pending';
  message?: string;
  resourceId?: string;
  credentials?: Record<string, string>;
}

export interface TemplateSource {
  type: 'github' | 'gitea' | 'local';
  url: string;
  branch?: string;
  path?: string;
}

export interface RegisteredTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  source: TemplateSource;
  metadata?: TemplateMetadata;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

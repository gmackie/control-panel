export interface ProvisioningContext {
  applicationId: string;
  applicationName: string;
  applicationSlug: string;
  gitProvider: string;
  deployProvider: string;
  dbProvider: string;
  modules: string[];
  repositoryUrl?: string;
}

export interface ProvisioningResult {
  provider: string;
  resourceType: string;
  status: 'success' | 'failed' | 'skipped';
  resourceId?: string;
  resourceName?: string;
  credentials?: Record<string, string>;
  message?: string;
  error?: string;
}

export interface ProvisioningStep {
  name: string;
  provider: string;
  execute: (ctx: ProvisioningContext) => Promise<ProvisioningResult>;
  shouldRun: (ctx: ProvisioningContext) => boolean;
  rollback?: (ctx: ProvisioningContext, result: ProvisioningResult) => Promise<void>;
}

export interface DatabaseProvisioningResult extends ProvisioningResult {
  resourceType: 'database';
  credentials?: {
    DATABASE_URL: string;
    DATABASE_HOST?: string;
    DATABASE_NAME?: string;
    DATABASE_USER?: string;
    DATABASE_PASSWORD?: string;
  };
}

export interface DeployProvisioningResult extends ProvisioningResult {
  resourceType: 'deployment_project';
  credentials?: {
    VERCEL_PROJECT_ID?: string;
    VERCEL_ORG_ID?: string;
  };
  productionUrl?: string;
  previewUrl?: string;
}

export interface AuthProvisioningResult extends ProvisioningResult {
  resourceType: 'auth_application';
  credentials?: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
    CLERK_SECRET_KEY?: string;
  };
}

export interface ProvisioningPlan {
  steps: ProvisioningStep[];
  context: ProvisioningContext;
}

export interface ProvisioningOutcome {
  success: boolean;
  results: ProvisioningResult[];
  credentials: Record<string, string>;
  errors: string[];
}

export interface ProvisionerConfig {
  neon?: {
    apiKey: string;
  };
  vercel?: {
    token: string;
    teamId?: string;
  };
  clerk?: {
    secretKey: string;
  };
  stripe?: {
    secretKey: string;
  };
}

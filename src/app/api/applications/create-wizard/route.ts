import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  provisionApplication, 
  AppConfig as ProvisionerAppConfig,
  ProvisioningResult 
} from '@/lib/provisioning';
import { SecretInput } from '@/lib/provisioning/secrets-service';

/**
 * Wizard Configuration Interface
 * This is the format received from the frontend wizard
 */
interface WizardConfig {
  // Basic Info
  name: string;
  slug: string;
  description: string;
  
  // Tech Stack
  language?: "typescript" | "javascript" | "python" | "go";
  framework?: "nextjs" | "express" | "fastapi" | "django" | "gin" | "none";
  type?: "web" | "api" | "worker" | "cron";
  
  // Repository
  repository: {
    provider: "gitea" | "github" | "gitlab";
    visibility: "public" | "private";
    template?: string;
    autoInit: boolean;
    defaultBranch: string;
  };
  
  // Integrations with secrets
  integrations: {
    [key: string]: {
      enabled: boolean;
      config: Record<string, unknown>;
      secrets: Record<string, string>;
    };
  };
  
  // Deployment
  deployment: {
    environments: {
      staging: {
        enabled: boolean;
        domain?: string;
        cluster?: string;
        namespace?: string;
      };
      production: {
        enabled: boolean;
        domain?: string;
        cluster?: string;
        namespace?: string;
      };
    };
    
    resources: {
      cpu: {
        request: number;
        limit: number;
      };
      memory: {
        request: number;
        limit: number;
      };
      replicas: {
        min: number;
        max: number;
      };
    };
    
    registry: {
      provider: "harbor" | "dockerhub" | "gcr";
      namespace?: string;
      imageName?: string;
    };
    
    cicd: {
      provider: "gitea-actions" | "github-actions" | "gitlab-ci";
      autoDeployStaging: boolean;
      autoDeployProduction: boolean;
      runTests: boolean;
      buildCache: boolean;
    };
  };
  
  monitoring: {
    enabled: boolean;
    provider: "prometheus" | "datadog" | "newrelic";
    alerts: boolean;
    logging: boolean;
    tracing: boolean;
  };
}

/**
 * Convert wizard config to provisioner config format
 */
function convertToProvisionerConfig(wizardConfig: WizardConfig): ProvisionerAppConfig {
  // Extract enabled integrations
  const enabledIntegrations = Object.entries(wizardConfig.integrations)
    .filter(([, integration]) => integration.enabled)
    .map(([key]) => key);
  
  // Convert secrets from all enabled integrations
  const secrets: SecretInput[] = [];
  for (const [integrationKey, integration] of Object.entries(wizardConfig.integrations)) {
    if (integration.enabled && integration.secrets) {
      for (const [secretKey, secretValue] of Object.entries(integration.secrets)) {
        if (secretValue) {
          secrets.push({
            name: secretKey,
            value: secretValue,
            description: `Secret for ${integrationKey}`,
            environment: "all",
          });
        }
      }
    }
  }
  
  // Determine enabled environments
  const environments: ("staging" | "production")[] = [];
  if (wizardConfig.deployment.environments.staging.enabled) {
    environments.push("staging");
  }
  if (wizardConfig.deployment.environments.production.enabled) {
    environments.push("production");
  }
  
  return {
    name: wizardConfig.name,
    slug: wizardConfig.slug,
    description: wizardConfig.description,
    
    language: wizardConfig.language || "typescript",
    framework: wizardConfig.framework || "nextjs",
    type: wizardConfig.type || "web",
    
    repository: {
      provider: "gitea", // Only supporting Gitea for now
      visibility: wizardConfig.repository.visibility,
      templateRepo: wizardConfig.repository.template,
      defaultBranch: wizardConfig.repository.defaultBranch,
    },
    
    integrations: enabledIntegrations,
    secrets,
    
    deployment: {
      environments,
      domain: wizardConfig.deployment.environments.production.domain,
      stagingDomain: wizardConfig.deployment.environments.staging.domain,
      autoDeployEnabled: wizardConfig.deployment.cicd.autoDeployStaging || 
                         wizardConfig.deployment.cicd.autoDeployProduction,
      branchFilter: wizardConfig.repository.defaultBranch,
    },
    
    resources: {
      cpu: {
        requests: `${wizardConfig.deployment.resources.cpu.request}m`,
        limits: `${wizardConfig.deployment.resources.cpu.limit}m`,
      },
      memory: {
        requests: `${wizardConfig.deployment.resources.memory.request}Mi`,
        limits: `${wizardConfig.deployment.resources.memory.limit}Mi`,
      },
      replicas: {
        min: wizardConfig.deployment.resources.replicas.min,
        max: wizardConfig.deployment.resources.replicas.max,
      },
    },
  };
}

/**
 * POST /api/applications/create-wizard
 * 
 * Create a new application using the full provisioning workflow:
 * 1. Create app record in PostgreSQL
 * 2. Create Gitea repository
 * 3. Configure integrations
 * 4. Store encrypted secrets
 * 5. Create K8s namespace and resources
 * 6. Sync secrets to K8s
 * 7. Setup CI/CD webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wizardConfig: WizardConfig = await request.json();
    
    // Convert wizard config to provisioner format
    const provisionerConfig = convertToProvisionerConfig(wizardConfig);
    
    // Run the provisioning workflow
    const result: ProvisioningResult = await provisionApplication(provisionerConfig);
    
    if (!result.success) {
      // Return detailed error information
      return NextResponse.json({
        error: 'Provisioning failed',
        steps: result.steps,
        errors: result.errors,
      }, { status: 500 });
    }
    
    // Build response with useful links
    const giteaBaseUrl = process.env.GITEA_URL || 'https://gitea.gmac.io';
    const giteaUser = process.env.GITEA_USER || 'gmac';
    
    return NextResponse.json({
      success: true,
      applicationId: result.applicationId,
      message: 'Application provisioned successfully',
      steps: result.steps,
      links: {
        repository: `${giteaBaseUrl}/${giteaUser}/${wizardConfig.slug}`,
        dashboard: `/applications/${result.applicationId}/dashboard`,
        staging: wizardConfig.deployment.environments.staging.enabled
          ? `https://${wizardConfig.deployment.environments.staging.domain || `${wizardConfig.slug}-staging.gmac.io`}`
          : null,
        production: wizardConfig.deployment.environments.production.enabled
          ? `https://${wizardConfig.deployment.environments.production.domain || `${wizardConfig.slug}.gmac.io`}`
          : null,
      },
    });
    
  } catch (error) {
    console.error('Error in create-wizard:', error);
    return NextResponse.json(
      { 
        error: 'Failed to provision application',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/applications/create-wizard
 * 
 * Returns available options for the wizard (integrations, templates, etc.)
 */
export async function GET() {
  try {
    // Import integrations dynamically to get the full list
    const { INTEGRATIONS, getIntegrationsByCategory } = await import('@/lib/provisioning/integrations');
    
    // Get templates from Gitea (or return static list)
    const templates = [
      { id: 'nextjs-starter', name: 'Next.js Starter', language: 'typescript', framework: 'nextjs' },
      { id: 'express-api', name: 'Express API', language: 'typescript', framework: 'express' },
      { id: 'fastapi-starter', name: 'FastAPI Starter', language: 'python', framework: 'fastapi' },
      { id: 'blank', name: 'Empty Repository', language: 'any', framework: 'none' },
    ];
    
    // Group integrations by category
    const integrationsByCategory = {
      auth: getIntegrationsByCategory('auth'),
      payments: getIntegrationsByCategory('payments'),
      database: getIntegrationsByCategory('database'),
      ai: getIntegrationsByCategory('ai'),
      email: getIntegrationsByCategory('email'),
      monitoring: getIntegrationsByCategory('monitoring'),
      storage: getIntegrationsByCategory('storage'),
      analytics: getIntegrationsByCategory('analytics'),
    };
    
    return NextResponse.json({
      templates,
      integrations: INTEGRATIONS,
      integrationsByCategory,
      defaults: {
        language: 'typescript',
        framework: 'nextjs',
        type: 'web',
        repository: {
          provider: 'gitea',
          visibility: 'private',
          defaultBranch: 'main',
        },
        deployment: {
          resources: {
            cpu: { request: 100, limit: 500 },
            memory: { request: 128, limit: 512 },
            replicas: { min: 1, max: 3 },
          },
          cicd: {
            provider: 'gitea-actions',
            autoDeployStaging: true,
            autoDeployProduction: false,
            runTests: true,
            buildCache: true,
          },
        },
        monitoring: {
          provider: 'prometheus',
          alerts: true,
          logging: true,
          tracing: false,
        },
      },
    });
    
  } catch (error) {
    console.error('Error fetching wizard options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wizard options' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deploymentIntegration } from '@/lib/deployment/deployment-integration';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ApplicationActionSchema = z.object({
  action: z.enum(['deploy', 'scale', 'rollback', 'restart', 'sync', 'promote']),
  environment: z.string(),
  parameters: z.object({
    replicas: z.number().optional(),
    version: z.string().optional(),
    revision: z.string().optional(),
    custom_domain: z.string().optional(),
    force: z.boolean().default(false),
    target_environment: z.string().optional(), // for promote action
  }).optional(),
});

// POST /api/deployments/applications/[id]/actions - Execute deployment actions
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const application = deploymentIntegration.getApplication(params.id);
    
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, environment, parameters = {} } = ApplicationActionSchema.parse(body);

    const env = application.environments.find(e => e.name === environment);
    if (!env) {
      return NextResponse.json(
        { error: `Environment ${environment} not found` },
        { status: 404 }
      );
    }

    switch (action) {
      case 'deploy':
        return await handleDeployAction(params.id, environment, parameters, session.user.email!);
      
      case 'scale':
        return await handleScaleAction(params.id, environment, parameters, session.user.email!);
      
      case 'rollback':
        return await handleRollbackAction(params.id, environment, parameters, session.user.email!);
      
      case 'restart':
        return await handleRestartAction(params.id, environment, session.user.email!);
      
      case 'sync':
        return await handleSyncAction(params.id, environment, session.user.email!);
      
      case 'promote':
        return await handlePromoteAction(params.id, environment, parameters, session.user.email!);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid action data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error executing deployment action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}

// GET /api/deployments/applications/[id]/actions - Get available actions
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const application = deploymentIntegration.getApplication(params.id);
    
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');

    const availableActions = getAvailableActions(application, environment || undefined);

    return NextResponse.json({
      success: true,
      application_id: params.id,
      available_actions: availableActions,
      environments: application.environments.map(env => ({
        name: env.name,
        status: env.status,
        url: env.url,
        last_deployed: env.last_deployed,
      })),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching available actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available actions' },
      { status: 500 }
    );
  }
}

// Action handlers
async function handleDeployAction(
  applicationId: string, 
  environment: string, 
  parameters: any,
  userId: string
): Promise<NextResponse> {
  try {
    const workflowId = await deploymentIntegration.deployToEnvironment(
      applicationId,
      environment,
      {
        force: parameters.force,
        custom_domain: parameters.custom_domain,
        version: parameters.version,
      }
    );

    return NextResponse.json({
      success: true,
      workflow_id: workflowId,
      message: `Deployment to ${environment} initiated successfully`,
      action: 'deploy',
      executedBy: userId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Deploy failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleScaleAction(
  applicationId: string, 
  environment: string, 
  parameters: any,
  userId: string
): Promise<NextResponse> {
  try {
    if (!parameters.replicas || parameters.replicas < 0 || parameters.replicas > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid replica count (must be 0-50)' },
        { status: 400 }
      );
    }

    await deploymentIntegration.scaleDeployment(
      applicationId,
      environment,
      parameters.replicas
    );

    return NextResponse.json({
      success: true,
      message: `Scaled ${environment} to ${parameters.replicas} replicas`,
      action: 'scale',
      replicas: parameters.replicas,
      executedBy: userId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Scale failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleRollbackAction(
  applicationId: string, 
  environment: string, 
  parameters: any,
  userId: string
): Promise<NextResponse> {
  try {
    await deploymentIntegration.rollbackDeployment(
      applicationId,
      environment,
      parameters.revision
    );

    return NextResponse.json({
      success: true,
      message: `Rollback to ${parameters.revision || 'previous version'} initiated`,
      action: 'rollback',
      revision: parameters.revision,
      executedBy: userId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleRestartAction(
  applicationId: string, 
  environment: string,
  userId: string
): Promise<NextResponse> {
  try {
    const application = deploymentIntegration.getApplication(applicationId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    // In a real implementation, this would restart the pods
    console.log(`Restarting ${application.repository.name} in ${environment}`);

    return NextResponse.json({
      success: true,
      message: `Restart initiated for ${environment}`,
      action: 'restart',
      executedBy: userId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Restart failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleSyncAction(
  applicationId: string, 
  environment: string,
  userId: string
): Promise<NextResponse> {
  try {
    const application = deploymentIntegration.getApplication(applicationId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    const env = application.environments.find(e => e.name === environment);
    if (env?.argocd_app_name) {
      await deploymentIntegration.syncArgoCDApplication(env.argocd_app_name);
    }

    return NextResponse.json({
      success: true,
      message: `ArgoCD sync initiated for ${environment}`,
      action: 'sync',
      executedBy: userId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handlePromoteAction(
  applicationId: string, 
  environment: string,
  parameters: any,
  userId: string
): Promise<NextResponse> {
  try {
    if (!parameters.target_environment) {
      return NextResponse.json(
        { success: false, error: 'Target environment required for promotion' },
        { status: 400 }
      );
    }

    const application = deploymentIntegration.getApplication(applicationId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    const sourceEnv = application.environments.find(e => e.name === environment);
    const targetEnv = application.environments.find(e => e.name === parameters.target_environment);

    if (!sourceEnv || !targetEnv) {
      return NextResponse.json(
        { success: false, error: 'Source or target environment not found' },
        { status: 404 }
      );
    }

    // Promote by deploying the same version to target environment
    const workflowId = await deploymentIntegration.deployToEnvironment(
      applicationId,
      parameters.target_environment,
      {
        version: sourceEnv.version,
        force: parameters.force,
      }
    );

    return NextResponse.json({
      success: true,
      workflow_id: workflowId,
      message: `Promoting ${sourceEnv.version} from ${environment} to ${parameters.target_environment}`,
      action: 'promote',
      source_environment: environment,
      target_environment: parameters.target_environment,
      version: sourceEnv.version,
      executedBy: userId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Promotion failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Helper function to determine available actions
function getAvailableActions(application: any, environment?: string) {
  const actions: any[] = [];

  if (environment) {
    const env = application.environments.find((e: any) => e.name === environment);
    if (!env) return actions;

    // Deploy action
    actions.push({
      action: 'deploy',
      label: `Deploy to ${environment}`,
      description: 'Deploy the latest version or a specific version',
      available: true,
      parameters: ['version', 'custom_domain', 'force'],
    });

    // Scale action (only for deployed apps)
    if (env.status === 'deployed') {
      actions.push({
        action: 'scale',
        label: 'Scale Application',
        description: 'Scale the number of replicas',
        available: true,
        parameters: ['replicas'],
        constraints: { min_replicas: 0, max_replicas: 50 },
      });

      actions.push({
        action: 'restart',
        label: 'Restart Application',
        description: 'Restart all pods in the deployment',
        available: true,
        parameters: [],
      });

      actions.push({
        action: 'rollback',
        label: 'Rollback Deployment',
        description: 'Rollback to a previous version',
        available: true,
        parameters: ['revision'],
      });

      if (environment !== 'development') {
        actions.push({
          action: 'sync',
          label: 'Sync with Git',
          description: 'Sync ArgoCD application with Git repository',
          available: true,
          parameters: [],
        });
      }
    }

    // Promote action (for non-production environments)
    if (environment !== 'production' && env.status === 'deployed') {
      const targetEnvs = application.environments
        .filter((e: any) => e.name !== environment)
        .map((e: any) => e.name);

      if (targetEnvs.length > 0) {
        actions.push({
          action: 'promote',
          label: 'Promote to Next Environment',
          description: 'Promote this deployment to another environment',
          available: true,
          parameters: ['target_environment', 'force'],
          target_environments: targetEnvs,
        });
      }
    }
  } else {
    // Return all possible actions when no specific environment is requested
    actions.push(
      { action: 'deploy', label: 'Deploy', available: true },
      { action: 'scale', label: 'Scale', available: true },
      { action: 'rollback', label: 'Rollback', available: true },
      { action: 'restart', label: 'Restart', available: true },
      { action: 'sync', label: 'Sync', available: true },
      { action: 'promote', label: 'Promote', available: true }
    );
  }

  return actions;
}
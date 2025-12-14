import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deploymentIntegration } from '@/lib/deployment/deployment-integration';
import { z } from 'zod';

const CreateApplicationSchema = z.object({
  repository_id: z.number(),
  environments: z.array(z.string()),
  deployment_config: z.object({
    port: z.number().default(3000),
    health_check_path: z.string().default('/health'),
    dockerfile_path: z.string().default('Dockerfile'),
    application_type: z.enum(['nodejs', 'python', 'go', 'static', 'custom']).optional(),
    build_args: z.record(z.string()).default({}),
  }).optional(),
});

const DeployApplicationSchema = z.object({
  application_id: z.string(),
  environment: z.string(),
  options: z.object({
    force: z.boolean().default(false),
    custom_domain: z.string().optional(),
    version: z.string().optional(),
  }).default({}),
});

// GET /api/deployments/applications - Get all application deployments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');
    const status = searchParams.get('status');
    const repository_name = searchParams.get('repository_name');
    const includeStats = searchParams.get('stats') === 'true';
    const includeRepositories = searchParams.get('repositories') === 'true';

    const applications = deploymentIntegration.getApplications({
      environment: environment || undefined,
      status: status || undefined,
      repository_name: repository_name || undefined,
    });

    const response: any = {
      success: true,
      applications,
      total: applications.length,
      lastUpdated: new Date().toISOString(),
    };

    if (includeStats) {
      response.statistics = deploymentIntegration.getDeploymentStatistics();
    }

    if (includeRepositories) {
      response.repositories = await deploymentIntegration.fetchRepositories();
    }

    // Add environment configurations
    response.environments = deploymentIntegration.getEnvironmentConfigs();

    // Initialize with sample applications if none exist
    if (applications.length === 0) {
      await initializeSampleApplications();
      response.applications = deploymentIntegration.getApplications();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

// POST /api/deployments/applications - Create new application deployment or deploy existing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if this is a deployment request or application creation
    if (body.application_id) {
      // This is a deployment request
      const { application_id, environment, options } = DeployApplicationSchema.parse(body);
      
      const workflowId = await deploymentIntegration.deployToEnvironment(
        application_id,
        environment,
        options
      );

      const application = deploymentIntegration.getApplication(application_id);

      return NextResponse.json({
        success: true,
        workflow_id: workflowId,
        application,
        message: `Deployment to ${environment} initiated successfully`,
        deployedBy: session.user.email,
        deployedAt: new Date().toISOString(),
      });
    } else {
      // This is application creation
      const appData = CreateApplicationSchema.parse(body);
      
      // Fetch the repository
      const repositories = await deploymentIntegration.fetchRepositories();
      const repository = repositories.find(r => r.id === appData.repository_id);
      
      if (!repository) {
        return NextResponse.json(
          { success: false, error: 'Repository not found' },
          { status: 404 }
        );
      }

      const application = await deploymentIntegration.createApplicationDeployment(
        repository,
        appData.environments
      );

      return NextResponse.json({
        success: true,
        application,
        message: 'Application deployment configuration created successfully',
      }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in application deployment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// Initialize sample applications
async function initializeSampleApplications() {
  try {
    const repositories = await deploymentIntegration.fetchRepositories();
    
    for (const repo of repositories.slice(0, 3)) { // Only first 3 for demo
      const environments = repo.name === 'control-panel' 
        ? ['development', 'staging', 'production']
        : ['development', 'staging'];

      await deploymentIntegration.createApplicationDeployment(repo, environments);
    }
  } catch (error) {
    console.error('Error initializing sample applications:', error);
  }
}
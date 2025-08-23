import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GiteaService } from '@/lib/gitea/gitea-service';
import { K3sService } from '@/lib/k3s/k3s-service';
import { DeploymentService } from '@/lib/deployments/deployment-service';

const giteaService = new GiteaService();
const k3sService = new K3sService();
const deploymentService = new DeploymentService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'all';
    const status = searchParams.get('status') || undefined;
    const applicationId = searchParams.get('applicationId') || undefined;

    // Fetch deployments from multiple sources
    const [k3sDeployments, giteaActions] = await Promise.all([
      k3sService.getDeployments({ environment, applicationId }),
      giteaService.getWorkflowRuns({ status, limit: 50 }),
    ]);

    // Combine and format deployment data
    const deployments = await deploymentService.combineDeploymentData(
      k3sDeployments,
      giteaActions
    );

    // Filter by environment
    const filteredDeployments = environment === 'all' 
      ? deployments 
      : deployments.filter(d => d.environment === environment);

    // Fetch deployment history
    const history = await deploymentService.getDeploymentHistory({
      environment,
      limit: 20,
    });

    return NextResponse.json({
      deployments: filteredDeployments,
      history,
      total: filteredDeployments.length,
    });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applicationId, environment, branch = 'main', commit } = await request.json();

    if (!applicationId || !environment) {
      return NextResponse.json(
        { error: 'Missing required fields: applicationId, environment' },
        { status: 400 }
      );
    }

    // Get application details
    const application = await deploymentService.getApplication(applicationId);
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Trigger deployment pipeline
    const deployment = await deploymentService.triggerDeployment({
      applicationId,
      applicationName: application.name,
      environment,
      branch,
      commit,
      deployedBy: session.user.email || 'unknown',
      repository: application.repository,
    });

    // Start Gitea workflow if configured
    if (application.giteaRepo) {
      try {
        await giteaService.triggerWorkflow(
          application.giteaRepo.owner,
          application.giteaRepo.name,
          'deploy.yml',
          {
            environment,
            commit: commit || 'latest',
            deployment_id: deployment.id,
          }
        );
      } catch (workflowError) {
        console.error('Failed to trigger Gitea workflow:', workflowError);
        // Continue with deployment even if workflow fails
      }
    }

    return NextResponse.json({
      success: true,
      deployment,
      message: 'Deployment triggered successfully',
    });
  } catch (error) {
    console.error('Error triggering deployment:', error);
    return NextResponse.json(
      { error: 'Failed to trigger deployment' },
      { status: 500 }
    );
  }
}
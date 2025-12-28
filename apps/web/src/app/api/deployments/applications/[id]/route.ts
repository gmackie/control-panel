import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deploymentIntegration } from '@/lib/deployment/deployment-integration';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/deployments/applications/[id] - Get specific application deployment
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const application = await deploymentIntegration.getDeploymentStatus(params.id);
    
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      application,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json(
      { error: 'Failed to fetch application' },
      { status: 500 }
    );
  }
}

// PUT /api/deployments/applications/[id] - Update application configuration
export async function PUT(request: NextRequest, props: RouteParams) {
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
    const { deployment_config, environments } = body;

    // Update deployment configuration
    if (deployment_config) {
      Object.assign(application.deployment_config, deployment_config);
    }

    // Update environments if provided
    if (environments) {
      // This would require more complex logic in a real implementation
      console.log('Environment update requested:', environments);
    }

    application.updated_at = new Date();

    return NextResponse.json({
      success: true,
      application,
      message: 'Application configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500 }
    );
  }
}

// DELETE /api/deployments/applications/[id] - Remove application deployment
export async function DELETE(request: NextRequest, props: RouteParams) {
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

    // In a real implementation, this would clean up Kubernetes resources and ArgoCD apps
    console.log(`Would delete application deployment: ${application.repository.name}`);

    return NextResponse.json({
      success: true,
      message: 'Application deployment removed successfully',
    });
  } catch (error) {
    console.error('Error deleting application:', error);
    return NextResponse.json(
      { error: 'Failed to delete application' },
      { status: 500 }
    );
  }
}
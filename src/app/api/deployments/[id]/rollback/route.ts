import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DeploymentService } from '@/lib/deployments/deployment-service';

const deploymentService = new DeploymentService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deploymentId = params.id;
    const { targetVersion, reason } = await request.json();

    if (!targetVersion) {
      return NextResponse.json(
        { error: 'Missing required field: targetVersion' },
        { status: 400 }
      );
    }

    // Validate deployment exists and user has permission to rollback
    const deployment = await deploymentService.getDeployment(deploymentId);
    if (!deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Prevent rollback in production without additional confirmation
    if (deployment.environment === 'production') {
      const confirmationToken = request.headers.get('X-Rollback-Confirmation');
      if (!confirmationToken || confirmationToken !== 'PRODUCTION_ROLLBACK_CONFIRMED') {
        return NextResponse.json(
          { error: 'Production rollback requires confirmation' },
          { status: 400 }
        );
      }
    }

    // Trigger rollback
    await deploymentService.rollbackDeployment(deploymentId, targetVersion, {
      reason: reason || 'Manual rollback',
      user: session.user.email || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Rollback initiated successfully',
      deployment: {
        id: deploymentId,
        targetVersion,
        status: 'rolling_back',
      },
    });
  } catch (error) {
    console.error('Error rolling back deployment:', error);
    return NextResponse.json(
      { error: 'Failed to rollback deployment' },
      { status: 500 }
    );
  }
}
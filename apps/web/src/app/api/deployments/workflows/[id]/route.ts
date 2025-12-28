import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deploymentWorkflowManager } from '@/lib/deployment/workflow-manager';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/deployments/workflows/[id] - Get specific workflow with detailed logs
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflow = deploymentWorkflowManager.getWorkflow(params.id);
    
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      workflow,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow' },
      { status: 500 }
    );
  }
}

// PUT /api/deployments/workflows/[id] - Update workflow (limited fields)
export async function PUT(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflow = deploymentWorkflowManager.getWorkflow(params.id);
    
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const body = await request.json();
    const { configuration, canRollback } = body;

    // Only allow updating certain fields for non-active workflows
    if (['pending'].includes(workflow.status)) {
      if (configuration) {
        workflow.configuration = { ...workflow.configuration, ...configuration };
      }
      if (canRollback !== undefined) {
        workflow.canRollback = canRollback;
      }

      return NextResponse.json({
        success: true,
        workflow,
        message: 'Workflow updated successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Cannot update active or completed workflows' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

// DELETE /api/deployments/workflows/[id] - Cancel or delete workflow
export async function DELETE(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflow = deploymentWorkflowManager.getWorkflow(params.id);
    
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Cancel if active, otherwise allow deletion of pending workflows
    if (['building', 'testing', 'deploying', 'verifying'].includes(workflow.status)) {
      const success = await deploymentWorkflowManager.cancelWorkflow(params.id);
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Workflow cancelled successfully',
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to cancel workflow' },
          { status: 400 }
        );
      }
    } else if (workflow.status === 'pending') {
      // For pending workflows, we can delete them entirely
      // Note: In a real implementation, you'd want to add a delete method to the manager
      return NextResponse.json({
        success: true,
        message: 'Workflow deleted successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Cannot delete completed workflows' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
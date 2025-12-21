import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vercelService } from '@/lib/vercel/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const projectId = searchParams.get('projectId');

    switch (action) {
      case 'stats':
        const stats = await vercelService.getDashboardStats();
        return NextResponse.json(stats);

      case 'projects':
        const projects = await vercelService.getProjects();
        return NextResponse.json({ projects });

      case 'project':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const project = await vercelService.getProjectWithDeployments(projectId);
        return NextResponse.json(project);

      case 'deployments':
        if (projectId) {
          const projectDeployments = await vercelService.getDeploymentsByProject(projectId);
          return NextResponse.json({ deployments: projectDeployments });
        }
        const deployments = await vercelService.getRecentDeployments();
        return NextResponse.json({ deployments });

      case 'domains':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const domains = await vercelService.getProjectDomains(projectId);
        return NextResponse.json({ domains });

      case 'env-vars':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const envVars = await vercelService.getProjectEnvVars(projectId);
        return NextResponse.json({ envVars });

      case 'health':
        const healthy = await vercelService.healthCheck();
        return NextResponse.json({ healthy, service: 'vercel' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Vercel API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

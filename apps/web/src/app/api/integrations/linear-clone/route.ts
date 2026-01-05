import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createLinearCloneClient } from '@/lib/linear-clone/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createLinearCloneClient();
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'overview';
    const workspaceId = searchParams.get('workspaceId');

    switch (endpoint) {
      case 'overview': {
        const [user, workspaces, health] = await Promise.all([
          client.getCurrentUser(),
          client.getWorkspaces(),
          client.healthCheck(),
        ]);

        let stats = null;
        let projects: any[] = [];
        let issues: any[] = [];
        let cycles: any[] = [];

        if (workspaces.length > 0) {
          const primaryWorkspace = workspaceId 
            ? workspaces.find(w => w.id === workspaceId) || workspaces[0]
            : workspaces[0];

          if (primaryWorkspace) {
            [stats, projects, issues, cycles] = await Promise.all([
              client.getStats(primaryWorkspace.id),
              client.getProjects(primaryWorkspace.id),
              client.getIssues({ workspaceId: primaryWorkspace.id, limit: 20 }),
              client.getCycles(primaryWorkspace.id),
            ]);
          }
        }

        return NextResponse.json({
          user,
          workspaces,
          projects,
          issues,
          cycles,
          stats,
          health: {
            status: health ? 'healthy' : 'unhealthy',
          },
          summary: {
            totalWorkspaces: workspaces.length,
            totalProjects: projects.length,
            totalIssues: stats?.totalIssues || 0,
            openIssues: stats?.openIssues || 0,
            completedIssues: stats?.completedIssues || 0,
            activeCycles: stats?.activeCycles || 0,
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'workspaces': {
        const workspaces = await client.getWorkspaces();
        return NextResponse.json({ workspaces });
      }

      case 'projects': {
        if (!workspaceId) {
          return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
        }
        const projects = await client.getProjects(workspaceId);
        return NextResponse.json({ projects });
      }

      case 'issues': {
        const projectId = searchParams.get('projectId');
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        const issues = await client.getIssues({
          workspaceId: workspaceId || undefined,
          projectId: projectId || undefined,
          status: status || undefined,
          limit,
        });

        return NextResponse.json({ 
          issues,
          pagination: {
            total: issues.length,
            limit,
          },
        });
      }

      case 'cycles': {
        if (!workspaceId) {
          return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
        }
        const cycles = await client.getCycles(workspaceId);
        return NextResponse.json({ cycles });
      }

      case 'stats': {
        if (!workspaceId) {
          return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
        }
        const stats = await client.getStats(workspaceId);
        return NextResponse.json(stats);
      }

      case 'health': {
        const isHealthy = await client.healthCheck();
        return NextResponse.json({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching Linear Clone data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Linear Clone data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createLinearCloneClient();
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const result: any = {
      action,
      success: true,
      timestamp: new Date().toISOString(),
      performedBy: session.user?.email || 'unknown',
    };

    switch (action) {
      case 'create_issue': {
        const { projectId, title, description, status, priority, assigneeId } = params;
        if (!projectId || !title) {
          return NextResponse.json(
            { error: 'projectId and title required' },
            { status: 400 }
          );
        }

        const issue = await client.createIssue({
          projectId,
          title,
          description,
          status,
          priority,
          assigneeId,
        });

        result.issue = issue;
        result.message = `Issue "${title}" created successfully`;
        break;
      }

      case 'update_issue': {
        const { id, title, description, status, priority, assigneeId } = params;
        if (!id) {
          return NextResponse.json(
            { error: 'Issue id required' },
            { status: 400 }
          );
        }

        const issue = await client.updateIssue(id, {
          title,
          description,
          status,
          priority,
          assigneeId,
        });

        result.issue = issue;
        result.message = `Issue updated successfully`;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing Linear Clone action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute Linear Clone action', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

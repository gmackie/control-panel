import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neonService } from '@/lib/neon/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const projectId = searchParams.get('projectId');
    const branchId = searchParams.get('branchId');

    switch (action) {
      case 'stats':
        const stats = await neonService.getDashboardStats();
        return NextResponse.json(stats);

      case 'projects':
        const projects = await neonService.getProjects();
        return NextResponse.json({ projects });

      case 'project':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const project = await neonService.getProject(projectId);
        return NextResponse.json({ project });

      case 'branches':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const branches = await neonService.getBranches(projectId);
        return NextResponse.json({ branches });

      case 'endpoints':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const endpoints = await neonService.getEndpoints(projectId);
        return NextResponse.json({ endpoints });

      case 'databases':
        if (!projectId || !branchId) {
          return NextResponse.json({ error: 'projectId and branchId required' }, { status: 400 });
        }
        const databases = await neonService.getDatabases(projectId, branchId);
        return NextResponse.json({ databases });

      case 'operations':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const operations = await neonService.getOperations(projectId);
        return NextResponse.json({ operations });

      case 'health':
        const healthy = await neonService.healthCheck();
        return NextResponse.json({ healthy, service: 'neon' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Neon API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
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

    const body = await request.json();
    const { action, projectId, branchId, endpointId, name, region, pgVersion, parentId, roleName, databaseName } = body;

    switch (action) {
      case 'create-project':
        if (!name) {
          return NextResponse.json({ error: 'name required' }, { status: 400 });
        }
        const newProject = await neonService.createProject(name, { region, pgVersion });
        return NextResponse.json({ ...newProject, action: 'created' });

      case 'delete-project':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const deletedProject = await neonService.deleteProject(projectId);
        return NextResponse.json({ ...deletedProject, action: 'deleted' });

      case 'create-branch':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const newBranch = await neonService.createBranch(projectId, name, parentId);
        return NextResponse.json({ ...newBranch, action: 'created' });

      case 'delete-branch':
        if (!projectId || !branchId) {
          return NextResponse.json({ error: 'projectId and branchId required' }, { status: 400 });
        }
        const deletedBranch = await neonService.deleteBranch(projectId, branchId);
        return NextResponse.json({ ...deletedBranch, action: 'deleted' });

      case 'start-endpoint':
        if (!projectId || !endpointId) {
          return NextResponse.json({ error: 'projectId and endpointId required' }, { status: 400 });
        }
        const startedEndpoint = await neonService.startEndpoint(projectId, endpointId);
        return NextResponse.json({ ...startedEndpoint, action: 'started' });

      case 'suspend-endpoint':
        if (!projectId || !endpointId) {
          return NextResponse.json({ error: 'projectId and endpointId required' }, { status: 400 });
        }
        const suspendedEndpoint = await neonService.suspendEndpoint(projectId, endpointId);
        return NextResponse.json({ ...suspendedEndpoint, action: 'suspended' });

      case 'get-connection-string':
        if (!projectId || !branchId || !roleName || !databaseName) {
          return NextResponse.json({ error: 'projectId, branchId, roleName, and databaseName required' }, { status: 400 });
        }
        const connectionString = await neonService.getConnectionString(projectId, branchId, roleName, databaseName);
        return NextResponse.json(connectionString);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Neon API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApplicationRegistry } from '@/lib/applications/application-registry';

const registry = new ApplicationRegistry();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const filter = searchParams.get('filter'); // 'linked', 'unlinked', 'all'
    const source = searchParams.get('source'); // 'gitea', 'kubernetes', 'all'

    // Get single application by ID
    if (id) {
      const app = await registry.getApplication(id);
      if (!app) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      return NextResponse.json({ application: app });
    }

    // Get all applications
    let applications = await registry.discoverApplications();

    // Apply filters
    if (filter === 'linked') {
      applications = applications.filter(app => app.linked);
    } else if (filter === 'unlinked') {
      applications = applications.filter(app => !app.linked);
    }

    if (source === 'gitea') {
      applications = applications.filter(app => app.gitea);
    } else if (source === 'kubernetes') {
      applications = applications.filter(app => app.kubernetes);
    }

    // Calculate summary stats
    const summary = {
      total: applications.length,
      linked: applications.filter(a => a.linked).length,
      unlinked: applications.filter(a => !a.linked).length,
      healthy: applications.filter(a => a.kubernetes?.status === 'healthy').length,
      degraded: applications.filter(a => a.kubernetes?.status === 'degraded').length,
      unhealthy: applications.filter(a => a.kubernetes?.status === 'unhealthy').length,
      giteaOnly: applications.filter(a => a.gitea && !a.kubernetes).length,
      k8sOnly: applications.filter(a => a.kubernetes && !a.gitea).length,
    };

    return NextResponse.json({
      applications,
      summary,
      mappings: registry.getMappings(),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch applications',
        details: error instanceof Error ? error.message : 'Unknown error',
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

    const body = await request.json();
    const { action, mapping } = body;

    if (action === 'add_mapping') {
      if (!mapping?.giteaRepo || !mapping?.k8sNamespace || !mapping?.k8sDeployment) {
        return NextResponse.json(
          { error: 'Missing required fields: giteaRepo, k8sNamespace, k8sDeployment' },
          { status: 400 }
        );
      }

      await registry.addMapping(mapping);
      
      return NextResponse.json({
        success: true,
        message: `Mapping added: ${mapping.giteaRepo} -> ${mapping.k8sNamespace}/${mapping.k8sDeployment}`,
        mappings: registry.getMappings(),
      });
    }

    if (action === 'remove_mapping') {
      if (!mapping?.giteaRepo) {
        return NextResponse.json(
          { error: 'Missing required field: giteaRepo' },
          { status: 400 }
        );
      }

      await registry.removeMapping(mapping.giteaRepo);
      
      return NextResponse.json({
        success: true,
        message: `Mapping removed for ${mapping.giteaRepo}`,
        mappings: registry.getMappings(),
      });
    }

    if (action === 'refresh') {
      // Force cache invalidation and re-fetch
      const applications = await registry.discoverApplications();
      
      return NextResponse.json({
        success: true,
        message: 'Applications refreshed',
        count: applications.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: add_mapping, remove_mapping, or refresh' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error managing applications:', error);
    return NextResponse.json(
      { 
        error: 'Failed to manage applications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

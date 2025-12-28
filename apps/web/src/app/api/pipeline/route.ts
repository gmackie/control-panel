import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Lazy import commitTracker to avoid module-level errors from libsql
let commitTrackerModule: typeof import('@/lib/pipeline/commit-tracker') | null = null;
async function getCommitTracker() {
  if (!commitTrackerModule) {
    try {
      commitTrackerModule = await import('@/lib/pipeline/commit-tracker');
    } catch (err) {
      console.warn('Failed to load commitTracker module:', err);
      return null;
    }
  }
  return commitTrackerModule?.commitTracker;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const commitTracker = await getCommitTracker();
    if (!commitTracker) {
      return NextResponse.json(
        { error: 'Pipeline tracking service unavailable' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const repository = searchParams.get('repository');
    const commitSha = searchParams.get('commit');
    const action = searchParams.get('action') || 'journeys';

    if (!repository && !commitSha) {
      return NextResponse.json(
        { error: 'Either repository or commit parameter is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'journey': {
        // Get single commit journey
        if (!commitSha) {
          return NextResponse.json(
            { error: 'commit parameter required for journey action' },
            { status: 400 }
          );
        }
        const journey = await commitTracker.getCommitJourney(commitSha);
        if (!journey) {
          return NextResponse.json(
            { error: 'Commit not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ journey });
      }

      case 'journeys': {
        // Get recent commit journeys for a repository
        if (!repository) {
          return NextResponse.json(
            { error: 'repository parameter required for journeys action' },
            { status: 400 }
          );
        }
        const limit = parseInt(searchParams.get('limit') || '10');
        const journeys = await commitTracker.getRecentCommitJourneys(repository, limit);
        return NextResponse.json({ journeys, repository });
      }

      case 'compare': {
        // Compare staging vs production
        if (!repository) {
          return NextResponse.json(
            { error: 'repository parameter required for compare action' },
            { status: 400 }
          );
        }
        const comparison = await commitTracker.compareEnvironments(repository);
        return NextResponse.json({ comparison });
      }

      case 'sync': {
        // Sync from Gitea and K8s
        if (!repository) {
          return NextResponse.json(
            { error: 'repository parameter required for sync action' },
            { status: 400 }
          );
        }
        const namespace = searchParams.get('namespace');
        
        await commitTracker.syncFromGitea(repository);
        if (namespace) {
          await commitTracker.syncFromK8s(repository, namespace);
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `Synced data for ${repository}` 
        });
      }

      case 'environment': {
        // Get environment status
        if (!repository) {
          return NextResponse.json(
            { error: 'repository parameter required' },
            { status: 400 }
          );
        }
        const environment = searchParams.get('environment') || 'staging';
        const status = await commitTracker.getEnvironmentStatus(repository, environment);
        return NextResponse.json({ status, environment, repository });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in pipeline API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
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

    const commitTracker = await getCommitTracker();
    if (!commitTracker) {
      return NextResponse.json(
        { error: 'Pipeline tracking service unavailable' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'record_commit': {
        const { commit } = body;
        if (!commit) {
          return NextResponse.json(
            { error: 'commit data required' },
            { status: 400 }
          );
        }
        await commitTracker.recordCommit(commit);
        return NextResponse.json({ success: true, message: 'Commit recorded' });
      }

      case 'record_pipeline': {
        const { pipeline } = body;
        if (!pipeline) {
          return NextResponse.json(
            { error: 'pipeline data required' },
            { status: 400 }
          );
        }
        const id = await commitTracker.recordPipelineRun(pipeline);
        return NextResponse.json({ success: true, id });
      }

      case 'update_pipeline': {
        const { id, status, conclusion, finishedAt } = body;
        if (!id || !status) {
          return NextResponse.json(
            { error: 'id and status required' },
            { status: 400 }
          );
        }
        await commitTracker.updatePipelineStatus(id, status, conclusion, finishedAt);
        return NextResponse.json({ success: true });
      }

      case 'record_deployment': {
        const { deployment } = body;
        if (!deployment) {
          return NextResponse.json(
            { error: 'deployment data required' },
            { status: 400 }
          );
        }
        const id = await commitTracker.recordDeployment(deployment);
        return NextResponse.json({ success: true, id });
      }

      case 'update_deployment': {
        const { id, status, healthCheckStatus, readyReplicas } = body;
        if (!id || !status) {
          return NextResponse.json(
            { error: 'id and status required' },
            { status: 400 }
          );
        }
        await commitTracker.updateDeploymentStatus(id, status, healthCheckStatus, readyReplicas);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in pipeline API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

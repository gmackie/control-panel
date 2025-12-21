import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sentryService } from '@/lib/sentry/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const projectSlug = searchParams.get('project');
    const issueId = searchParams.get('issueId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    switch (action) {
      case 'stats':
        const stats = await sentryService.getDashboardStats();
        return NextResponse.json(stats);

      case 'projects':
        const projects = await sentryService.getProjects();
        return NextResponse.json({ projects });

      case 'project':
        if (!projectSlug) {
          return NextResponse.json({ error: 'project slug required' }, { status: 400 });
        }
        const project = await sentryService.getProject(projectSlug);
        return NextResponse.json(project);

      case 'issues':
        const issues = await sentryService.getUnresolvedIssues(projectSlug || undefined);
        return NextResponse.json({ issues });

      case 'issue':
        if (!issueId) {
          return NextResponse.json({ error: 'issueId required' }, { status: 400 });
        }
        const issue = await sentryService.getIssue(issueId);
        return NextResponse.json(issue);

      case 'issue-events':
        if (!issueId) {
          return NextResponse.json({ error: 'issueId required' }, { status: 400 });
        }
        const events = await sentryService.getIssueEvents(issueId, limit);
        return NextResponse.json({ events });

      case 'releases':
        const releases = await sentryService.getReleases(limit);
        return NextResponse.json({ releases });

      case 'teams':
        const teams = await sentryService.getTeams();
        return NextResponse.json({ teams });

      case 'health':
        const healthy = await sentryService.healthCheck();
        return NextResponse.json({ healthy, service: 'sentry' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sentry API error:', error);
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
    const { action, issueId } = body;

    switch (action) {
      case 'resolve-issue':
        if (!issueId) {
          return NextResponse.json({ error: 'issueId required' }, { status: 400 });
        }
        const resolvedIssue = await sentryService.resolveIssue(issueId);
        return NextResponse.json({ issue: resolvedIssue, action: 'resolved' });

      case 'ignore-issue':
        if (!issueId) {
          return NextResponse.json({ error: 'issueId required' }, { status: 400 });
        }
        const ignoredIssue = await sentryService.ignoreIssue(issueId);
        return NextResponse.json({ issue: ignoredIssue, action: 'ignored' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sentry API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

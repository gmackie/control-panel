import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { postHogService } from '@/lib/posthog/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const eventName = searchParams.get('event');

    switch (action) {
      case 'stats':
        const stats = await postHogService.getDashboardStats();
        return NextResponse.json(stats);

      case 'project':
        const project = await postHogService.getProject();
        return NextResponse.json(project);

      case 'events':
        if (eventName) {
          const eventsByType = await postHogService.getEventsByType(eventName, limit);
          return NextResponse.json({ events: eventsByType });
        }
        const events = await postHogService.getRecentEvents(limit);
        return NextResponse.json({ events });

      case 'event-definitions':
        const eventDefs = await postHogService.getEventDefinitions();
        return NextResponse.json({ eventDefinitions: eventDefs });

      case 'persons':
        const persons = await postHogService.getPersons(limit);
        return NextResponse.json({ persons });

      case 'feature-flags':
        const flags = await postHogService.getFeatureFlags();
        return NextResponse.json({ featureFlags: flags });

      case 'insights':
        const insights = await postHogService.getInsights();
        return NextResponse.json({ insights });

      case 'dashboards':
        const dashboards = await postHogService.getDashboards();
        return NextResponse.json({ dashboards });

      case 'cohorts':
        const cohorts = await postHogService.getCohorts();
        return NextResponse.json({ cohorts });

      case 'health':
        const healthy = await postHogService.healthCheck();
        return NextResponse.json({ healthy, service: 'posthog' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('PostHog API error:', error);
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
    const { action, flagId, active } = body;

    switch (action) {
      case 'toggle-flag':
        if (!flagId || active === undefined) {
          return NextResponse.json({ error: 'flagId and active required' }, { status: 400 });
        }
        const flag = await postHogService.toggleFeatureFlag(flagId, active);
        return NextResponse.json({ featureFlag: flag, action: active ? 'enabled' : 'disabled' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('PostHog API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

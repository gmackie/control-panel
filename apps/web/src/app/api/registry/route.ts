import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { harborService } from '@/lib/harbor/service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'health': {
        const health = await harborService.healthCheck();
        return NextResponse.json(health);
      }

      case 'projects': {
        const projects = await harborService.listProjects();
        return NextResponse.json(projects);
      }

      default: {
        // Return stats by default
        const stats = await harborService.getStats();
        return NextResponse.json(stats);
      }
    }
  } catch (error: unknown) {
    console.error('Error in registry API:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch registry data';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

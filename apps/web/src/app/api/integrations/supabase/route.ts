import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const projectRef = searchParams.get('projectRef');

    switch (action) {
      case 'stats':
        const stats = await supabaseService.getDashboardStats();
        return NextResponse.json(stats);

      case 'projects':
        const projects = await supabaseService.getProjects();
        return NextResponse.json({ projects });

      case 'project':
        if (!projectRef) {
          return NextResponse.json({ error: 'projectRef required' }, { status: 400 });
        }
        const project = await supabaseService.getProject(projectRef);
        return NextResponse.json(project);

      case 'functions':
        if (!projectRef) {
          return NextResponse.json({ error: 'projectRef required' }, { status: 400 });
        }
        const functions = await supabaseService.getProjectFunctions(projectRef);
        return NextResponse.json({ functions });

      case 'database-health':
        if (!projectRef) {
          return NextResponse.json({ error: 'projectRef required' }, { status: 400 });
        }
        const dbHealth = await supabaseService.getDatabaseHealth(projectRef);
        return NextResponse.json(dbHealth);

      case 'health':
        const healthy = await supabaseService.healthCheck();
        return NextResponse.json({ healthy, service: 'supabase' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Supabase API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

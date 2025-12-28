import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApplication } from '@/lib/applications/manager';
import { applicationsRepo } from '@/lib/db/repositories';
import { isPostgresConfigured } from '@/lib/db/postgres';
import { CreateApplicationRequest } from '@/types/applications';

function safeJson<T>(value: T): T {
  // Remove undefined values to satisfy undici/NextResponse.json serializer
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use PostgreSQL if configured, otherwise fallback to in-memory
    if (isPostgresConfigured()) {
      const apps = await applicationsRepo.getAll();
      // Transform to match the expected Application format
      const applications = apps.map(app => ({
        id: app.id,
        name: app.name,
        description: app.description || '',
        slug: app.slug,
        repositoryUrl: app.repositoryUrl,
        language: app.language,
        framework: app.framework,
        type: app.type,
        status: app.status,
        apiKeys: [],  // Will be loaded separately if needed
        secrets: [],  // Will be loaded separately if needed
        integrations: [],
        settings: {
          environment: (app.settings as any)?.environment || 'development',
          features: (app.settings as any)?.features || {},
          autoDeployEnabled: (app.settings as any)?.autoDeployEnabled || false,
        },
        createdAt: app.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: app.updatedAt?.toISOString() || new Date().toISOString(),
        ownerId: 'gmackie', // Default owner
      }));
      return NextResponse.json(safeJson(applications));
    }
    
    // Fallback to in-memory (legacy behavior)
    const { getApplications } = await import('@/lib/applications/manager');
    const applications = await getApplications((session.user as any).login || session.user.email!);
    return NextResponse.json(safeJson(applications));
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
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

    const body: CreateApplicationRequest = await request.json();
    
    if (!body.name) {
      return NextResponse.json(
        { error: 'Application name is required' },
        { status: 400 }
      );
    }

    const application = await createApplication(
      body,
      (session.user as any).login || session.user.email!
    );

    return NextResponse.json(safeJson(application), { status: 201 });
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApplication, getApplications } from '@/lib/applications/manager';
import { getDbAsync } from '@/lib/db';
import { applications, desc } from '@repo/db';
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

    const db = await getDbAsync();
    
    if (db) {
      // Use Neon database
      const apps = await db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt));
      
      const applicationsList = apps.map(app => ({
        id: app.id,
        name: app.name,
        description: app.description || '',
        slug: app.slug,
        repositoryUrl: app.repositoryUrl,
        status: app.status,
        gitProvider: app.gitProvider,
        deployProvider: app.deployProvider,
        dbProvider: app.dbProvider,
        apiKeys: [],
        secrets: [],
        integrations: [],
        settings: {
          environment: 'development',
          features: {},
          autoDeployEnabled: false,
        },
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
        ownerId: 'gmackie',
      }));
      return NextResponse.json(safeJson(applicationsList));
    }
    
    // Fallback to in-memory (legacy behavior)
    const appList = await getApplications((session.user as { login?: string }).login || session.user.email!);
    return NextResponse.json(safeJson(appList));
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

    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json(
        { error: 'Application name is required' },
        { status: 400 }
      );
    }

    const db = await getDbAsync();
    
    if (db) {
      const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      const [newApp] = await db.insert(applications).values({
        name: body.name,
        slug,
        description: body.description || null,
        repositoryUrl: body.repository || null,
        status: 'active',
      }).returning();

      return NextResponse.json(safeJson({
        id: newApp.id,
        name: newApp.name,
        slug: newApp.slug,
        description: newApp.description,
        repositoryUrl: newApp.repositoryUrl,
        status: newApp.status,
        createdAt: newApp.createdAt.toISOString(),
        updatedAt: newApp.updatedAt.toISOString(),
      }), { status: 201 });
    }
    
    const application = await createApplication(
      body,
      (session.user as { login?: string }).login || session.user.email!
    );

    return NextResponse.json(safeJson(application), { status: 201 });
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { error: 'Failed to create application', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, vercelProjects, expoProjects, neonProjects, eq } from '@repo/db';

function safeJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;

    const [integration] = await db
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.id, id))
      .limit(1);

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    let linkedProjects: unknown[] = [];
    
    if (integration.provider === 'vercel') {
      linkedProjects = await db
        .select()
        .from(vercelProjects)
        .where(eq(vercelProjects.orgIntegrationId, id));
    } else if (integration.provider === 'expo') {
      linkedProjects = await db
        .select()
        .from(expoProjects)
        .where(eq(expoProjects.orgIntegrationId, id));
    } else if (integration.provider === 'neon') {
      linkedProjects = await db
        .select()
        .from(neonProjects)
        .where(eq(neonProjects.orgIntegrationId, id));
    }

    return NextResponse.json(safeJson({
      ...integration,
      config: integration.config ? JSON.parse(integration.config) : null,
      linkedProjects,
    }));
  } catch (error) {
    console.error('Error fetching org integration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(orgIntegrations)
      .set({
        name: body.name ?? existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        enabled: body.enabled ?? existing.enabled,
        config: body.config !== undefined ? JSON.stringify(body.config) : existing.config,
        credentials: body.credentials !== undefined ? JSON.stringify(body.credentials) : existing.credentials,
        lastSyncAt: body.lastSyncAt ? new Date(body.lastSyncAt) : existing.lastSyncAt,
        lastSyncStatus: body.lastSyncStatus ?? existing.lastSyncStatus,
        lastSyncError: body.lastSyncError !== undefined ? body.lastSyncError : existing.lastSyncError,
        updatedAt: new Date(),
      })
      .where(eq(orgIntegrations.id, id))
      .returning();

    return NextResponse.json(safeJson({
      ...updated,
      config: updated.config ? JSON.parse(updated.config) : null,
    }));
  } catch (error) {
    console.error('Error updating org integration:', error);
    return NextResponse.json(
      { error: 'Failed to update integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    await db.delete(orgIntegrations).where(eq(orgIntegrations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting org integration:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

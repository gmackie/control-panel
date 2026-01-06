import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, vercelProjects, expoProjects, neonProjects, tursoDatabases, eq } from '@repo/db';

function safeJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

async function syncVercelProjects(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { teamId?: string; token: string }) {
  const response = await fetch(`https://api.vercel.com/v9/projects${config.teamId ? `?teamId=${config.teamId}` : ''}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Vercel API error: ${response.statusText}`);
  }

  const data = await response.json();
  const projects = data.projects || [];
  
  const syncedProjects = [];
  for (const project of projects) {
    const existing = await db
      .select()
      .from(vercelProjects)
      .where(eq(vercelProjects.vercelProjectId, project.id))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(vercelProjects)
        .set({
          name: project.name,
          framework: project.framework || null,
          productionUrl: project.targets?.production?.url || null,
          updatedAt: new Date(),
        })
        .where(eq(vercelProjects.vercelProjectId, project.id))
        .returning();
      syncedProjects.push(updated);
    } else {
      const [created] = await db.insert(vercelProjects).values({
        vercelProjectId: project.id,
        name: project.name,
        framework: project.framework || null,
        productionUrl: project.targets?.production?.url || null,
        orgIntegrationId: integrationId,
      }).returning();
      syncedProjects.push(created);
    }
  }

  return syncedProjects;
}

async function syncExpoProjects(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { token: string; username?: string }) {
  const response = await fetch('https://api.expo.dev/v2/projects', {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Expo API error: ${response.statusText}`);
  }

  const data = await response.json();
  const projects = data.data || [];
  
  const syncedProjects = [];
  for (const project of projects) {
    const existing = await db
      .select()
      .from(expoProjects)
      .where(eq(expoProjects.expoProjectId, project.id))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(expoProjects)
        .set({
          name: project.name,
          slug: project.slug || null,
          updatedAt: new Date(),
        })
        .where(eq(expoProjects.expoProjectId, project.id))
        .returning();
      syncedProjects.push(updated);
    } else {
      const [created] = await db.insert(expoProjects).values({
        expoProjectId: project.id,
        name: project.name,
        slug: project.slug || null,
        orgIntegrationId: integrationId,
      }).returning();
      syncedProjects.push(created);
    }
  }

  return syncedProjects;
}

async function syncNeonProjects(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { apiKey: string }) {
  const response = await fetch('https://console.neon.tech/api/v2/projects', {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Neon API error: ${response.statusText}`);
  }

  const data = await response.json();
  const projects = data.projects || [];
  
  const syncedProjects = [];
  for (const project of projects) {
    const existing = await db
      .select()
      .from(neonProjects)
      .where(eq(neonProjects.neonProjectId, project.id))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(neonProjects)
        .set({
          name: project.name,
          regionId: project.region_id || null,
          updatedAt: new Date(),
        })
        .where(eq(neonProjects.neonProjectId, project.id))
        .returning();
      syncedProjects.push(updated);
    } else {
      const [created] = await db.insert(neonProjects).values({
        neonProjectId: project.id,
        name: project.name,
        regionId: project.region_id || null,
        orgIntegrationId: integrationId,
      }).returning();
      syncedProjects.push(created);
    }
  }

  return syncedProjects;
}

async function syncTursoDatabases(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { apiToken: string; organization?: string }) {
  const orgParam = config.organization ? `organizations/${config.organization}` : 'databases';
  const response = await fetch(`https://api.turso.tech/v1/${orgParam}`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Turso API error: ${response.statusText}`);
  }

  const data = await response.json();
  const databases = data.databases || [];
  
  const syncedDatabases = [];
  for (const database of databases) {
    const existing = await db
      .select()
      .from(tursoDatabases)
      .where(eq(tursoDatabases.tursoDbId, database.DbId || database.name))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(tursoDatabases)
        .set({
          name: database.Name || database.name,
          group: database.group || null,
          primaryRegion: database.primaryRegion || database.regions?.[0] || null,
          hostname: database.Hostname || database.hostname || null,
          updatedAt: new Date(),
        })
        .where(eq(tursoDatabases.tursoDbId, database.DbId || database.name))
        .returning();
      syncedDatabases.push(updated);
    } else {
      const [created] = await db.insert(tursoDatabases).values({
        tursoDbId: database.DbId || database.name,
        name: database.Name || database.name,
        group: database.group || null,
        primaryRegion: database.primaryRegion || database.regions?.[0] || null,
        hostname: database.Hostname || database.hostname || null,
        orgIntegrationId: integrationId,
      }).returning();
      syncedDatabases.push(created);
    }
  }

  return syncedDatabases;
}

export async function POST(
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

    if (!integration.credentials) {
      return NextResponse.json(
        { error: 'Integration credentials not configured' },
        { status: 400 }
      );
    }

    const credentials = JSON.parse(integration.credentials);
    const config = integration.config ? JSON.parse(integration.config) : {};

    let syncedProjects: unknown[] = [];
    let syncError: string | null = null;

    try {
      switch (integration.provider) {
        case 'vercel':
          syncedProjects = await syncVercelProjects(db, id, { ...config, token: credentials.token });
          break;
        case 'expo':
          syncedProjects = await syncExpoProjects(db, id, { ...config, token: credentials.token });
          break;
        case 'neon':
          syncedProjects = await syncNeonProjects(db, id, { apiKey: credentials.apiKey });
          break;
        case 'turso':
          syncedProjects = await syncTursoDatabases(db, id, { apiToken: credentials.apiToken, organization: config.organization });
          break;
        default:
          return NextResponse.json(
            { error: `Sync not supported for provider: ${integration.provider}` },
            { status: 400 }
          );
      }
    } catch (err) {
      syncError = err instanceof Error ? err.message : 'Unknown sync error';
    }

    await db
      .update(orgIntegrations)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: syncError ? 'failed' : 'success',
        lastSyncError: syncError,
        updatedAt: new Date(),
      })
      .where(eq(orgIntegrations.id, id));

    if (syncError) {
      return NextResponse.json(
        { error: 'Sync failed', details: syncError },
        { status: 500 }
      );
    }

    return NextResponse.json(safeJson({
      success: true,
      projectsCount: syncedProjects.length,
      projects: syncedProjects,
    }));
  } catch (error) {
    console.error('Error syncing org integration:', error);
    return NextResponse.json(
      { error: 'Failed to sync integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

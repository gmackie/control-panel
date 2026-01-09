import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';
import { TursoClient } from '@/lib/turso/client';

async function getTursoCredentials() {
  const envApiToken = process.env.TURSO_API_TOKEN;
  if (envApiToken) {
    return { apiToken: envApiToken, organization: process.env.TURSO_ORGANIZATION };
  }

  const db = await getDbAsync();
  if (!db) return null;

  const [integration] = await db
    .select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.provider, 'turso'))
    .limit(1);

  if (!integration?.credentials) return null;

  const credentials = JSON.parse(integration.credentials);

  return {
    apiToken: credentials.apiToken || credentials.token || credentials.apiKey,
    organization: credentials.organization,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = await getTursoCredentials();
    if (!creds?.apiToken) {
      return NextResponse.json(
        { error: 'Turso not configured. Add TURSO_API_TOKEN env var or configure in Integrations Hub.' },
        { status: 404 }
      );
    }

    const client = new TursoClient(creds.apiToken, creds.organization);

    const organizations = await client.listOrganizations();

    const orgDetails = await Promise.all(
      organizations.map(async (org) => {
        const [databasesRes, groupsRes, usageRes] = await Promise.all([
          client.listDatabases(org.slug).catch(() => ({ databases: [] })),
          client.listGroups(org.slug).catch(() => ({ groups: [] })),
          client.getOrganizationUsage(org.slug).catch(() => null),
        ]);

        const databases = databasesRes.databases;
        const groups = groupsRes.groups;

        const databaseDetails = await Promise.all(
          databases.slice(0, 20).map(async (db) => {
            let instances: Array<{
              uuid: string;
              name: string;
              type: string;
              region: string;
              hostname: string;
            }> = [];
            try {
              const res = await client.listInstances(db.Name, org.slug);
              instances = res.instances;
            } catch {
            }

            return {
              name: db.Name,
              dbId: db.DbId,
              hostname: db.Hostname,
              group: db.group,
              primaryRegion: db.primaryRegion,
              regions: db.regions || [],
              blockReads: db.block_reads,
              blockWrites: db.block_writes,
              deleteProtection: db.delete_protection,
              sleeping: db.sleeping,
              instances: instances.map((i) => ({
                uuid: i.uuid,
                name: i.name,
                type: i.type,
                region: i.region,
                hostname: i.hostname,
              })),
            };
          })
        );

        return {
          slug: org.slug,
          name: org.name,
          type: org.type,
          overages: org.overages,
          blockedReads: org.blocked_reads,
          blockedWrites: org.blocked_writes,
          databases: databaseDetails,
          groups: groups.map((g) => ({
            name: g.name,
            primary: g.primary,
            locations: g.locations,
            archived: g.archived,
          })),
          usage: usageRes,
        };
      })
    );

    const allDatabases = orgDetails.flatMap((o) => o.databases);
    const allGroups = orgDetails.flatMap((o) => o.groups);
    const allInstances = allDatabases.flatMap((d) => d.instances);

    const allRegions = new Set<string>();
    allGroups.forEach((g) => g.locations.forEach((loc) => allRegions.add(loc)));
    allDatabases.forEach((d) => d.regions.forEach((r) => allRegions.add(r)));

    let totalStorageBytes = 0;
    let totalRowsRead = 0;
    let totalRowsWritten = 0;

    orgDetails.forEach((org) => {
      if (org.usage?.organization?.usage) {
        totalStorageBytes += org.usage.organization.usage.storage_bytes || 0;
        totalRowsRead += org.usage.organization.usage.rows_read || 0;
        totalRowsWritten += org.usage.organization.usage.rows_written || 0;
      } else if (org.usage?.databases) {
        totalStorageBytes += org.usage.databases.storageBytes || 0;
      }
    });

    const sleepingDatabases = allDatabases.filter((d) => d.sleeping === true);
    const activeDatabases = allDatabases.filter((d) => d.sleeping !== true);
    const blockedDatabases = allDatabases.filter((d) => d.blockReads || d.blockWrites);
    const protectedDatabases = allDatabases.filter((d) => d.deleteProtection === true);

    return NextResponse.json({
      organizations: orgDetails,
      summary: {
        totalOrganizations: organizations.length,
        totalDatabases: allDatabases.length,
        totalGroups: allGroups.length,
        totalInstances: allInstances.length,
        activeDatabases: activeDatabases.length,
        sleepingDatabases: sleepingDatabases.length,
        blockedDatabases: blockedDatabases.length,
        protectedDatabases: protectedDatabases.length,
        regions: Array.from(allRegions),
        regionCount: allRegions.size,
        totalStorageBytes,
        totalStorageMB: Math.round((totalStorageBytes / (1024 * 1024)) * 100) / 100,
        totalStorageGB: Math.round((totalStorageBytes / (1024 * 1024 * 1024)) * 100) / 100,
        totalRowsRead,
        totalRowsWritten,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Turso data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Turso data' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';
import { NeonClient, NeonDatabase } from '@/lib/neon/client';

async function getNeonCredentials() {
  const envApiKey = process.env.NEON_API_KEY;
  if (envApiKey) {
    return { apiKey: envApiKey };
  }

  const db = await getDbAsync();
  if (!db) return null;

  const [integration] = await db
    .select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.provider, 'neon'))
    .limit(1);

  if (!integration?.credentials) return null;

  const credentials = JSON.parse(integration.credentials);

  return { apiKey: credentials.apiKey || credentials.token };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = await getNeonCredentials();
    if (!creds?.apiKey) {
      return NextResponse.json(
        { error: 'Neon not configured. Add integration in Integrations Hub.' },
        { status: 404 }
      );
    }

    const client = new NeonClient(creds.apiKey);

    const { projects } = await client.listProjects();

    const projectDetails = await Promise.all(
      projects.map(async (project) => {
        const [branchesRes, endpointsRes] = await Promise.all([
          client.listBranches(project.id).catch(() => ({ branches: [] })),
          client.listEndpoints(project.id).catch(() => ({ endpoints: [] })),
        ]);

        const branches = branchesRes.branches;
        const endpoints = endpointsRes.endpoints;

        const primaryBranch = branches.find(b => b.primary);
        let databases: NeonDatabase[] = [];
        if (primaryBranch) {
          const dbRes = await client.listDatabases(project.id, primaryBranch.id).catch(() => ({ databases: [] }));
          databases = dbRes.databases;
        }

        return {
          project: {
            id: project.id,
            name: project.name,
            region_id: project.region_id,
            pg_version: project.pg_version,
            proxy_host: project.proxy_host,
            cpu_used_sec: project.cpu_used_sec,
            active_time_seconds: project.active_time_seconds,
            compute_time_seconds: project.compute_time_seconds,
            written_data_bytes: project.written_data_bytes,
            data_transfer_bytes: project.data_transfer_bytes,
            data_storage_bytes_hour: project.data_storage_bytes_hour,
            created_at: project.created_at,
            updated_at: project.updated_at,
          },
          branches: branches.map(b => ({
            id: b.id,
            name: b.name,
            current_state: b.current_state,
            logical_size: b.logical_size,
            physical_size: b.physical_size,
            primary: b.primary,
            default: b.default,
            protected: b.protected,
            created_at: b.created_at,
            updated_at: b.updated_at,
          })),
          endpoints: endpoints.map(e => ({
            id: e.id,
            branch_id: e.branch_id,
            host: e.host,
            type: e.type,
            current_state: e.current_state,
            autoscaling_limit_min_cu: e.autoscaling_limit_min_cu,
            autoscaling_limit_max_cu: e.autoscaling_limit_max_cu,
            pooler_enabled: e.pooler_enabled,
            pooler_mode: e.pooler_mode,
            disabled: e.disabled,
            suspend_timeout_seconds: e.suspend_timeout_seconds,
            created_at: e.created_at,
            updated_at: e.updated_at,
          })),
          databases: databases.map(d => ({
            id: d.id,
            name: d.name,
            owner_name: d.owner_name,
            branch_id: d.branch_id,
            created_at: d.created_at,
            updated_at: d.updated_at,
          })),
        };
      })
    );

    let consumption: { periods: unknown[] } = { periods: [] };
    try {
      consumption = await client.getConsumption({ limit: 7 });
    } catch {
    }

    const allBranches = projectDetails.flatMap(p => p.branches);
    const allEndpoints = projectDetails.flatMap(p => p.endpoints);
    const allDatabases = projectDetails.flatMap(p => p.databases);

    const activeEndpoints = allEndpoints.filter(e => e.current_state === 'active');
    const idleEndpoints = allEndpoints.filter(e => e.current_state === 'idle');
    const regions = [...new Set(projects.map(p => p.region_id))];
    const pgVersions = [...new Set(projects.map(p => p.pg_version))];

    const totalStorageBytes = allBranches.reduce((sum, b) => sum + b.logical_size, 0);
    const totalComputeSeconds = projects.reduce((sum, p) => sum + p.compute_time_seconds, 0);
    const totalWrittenBytes = projects.reduce((sum, p) => sum + p.written_data_bytes, 0);
    const totalTransferBytes = projects.reduce((sum, p) => sum + p.data_transfer_bytes, 0);
    const totalActiveTimeSeconds = projects.reduce((sum, p) => sum + p.active_time_seconds, 0);

    return NextResponse.json({
      projects: projectDetails,
      consumption: consumption.periods,
      summary: {
        totalProjects: projects.length,
        totalBranches: allBranches.length,
        totalEndpoints: allEndpoints.length,
        totalDatabases: allDatabases.length,
        activeEndpoints: activeEndpoints.length,
        idleEndpoints: idleEndpoints.length,
        regions,
        pgVersions,
        totalStorageBytes,
        totalStorageMB: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100,
        totalComputeSeconds,
        totalComputeHours: Math.round(totalComputeSeconds / 3600 * 100) / 100,
        totalWrittenBytes,
        totalWrittenMB: Math.round(totalWrittenBytes / (1024 * 1024) * 100) / 100,
        totalTransferBytes,
        totalTransferMB: Math.round(totalTransferBytes / (1024 * 1024) * 100) / 100,
        totalActiveTimeSeconds,
        totalActiveTimeHours: Math.round(totalActiveTimeSeconds / 3600 * 100) / 100,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Neon data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Neon data' },
      { status: 500 }
    );
  }
}

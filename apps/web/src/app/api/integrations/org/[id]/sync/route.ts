import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, vercelProjects, expoProjects, neonProjects, tursoDatabases, giteaRepositories, githubRepositories, k3sDeployments, eq } from '@repo/db';
import { validateApiKey } from '@repo/api';

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

async function syncGiteaRepositories(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { token: string; baseUrl: string }) {
  const response = await fetch(`${config.baseUrl}/api/v1/user/repos?limit=100`, {
    headers: {
      Authorization: `token ${config.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gitea API error: ${response.statusText}`);
  }

  const repos = await response.json();
  
  const syncedRepos = [];
  for (const repo of repos) {
    const existing = await db
      .select()
      .from(giteaRepositories)
      .where(eq(giteaRepositories.giteaRepoId, String(repo.id)))
      .limit(1);

    const repoData = {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || null,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      defaultBranch: repo.default_branch || 'main',
      owner: repo.owner?.login || repo.owner?.username,
      private: repo.private || false,
      fork: repo.fork || false,
      archived: repo.archived || false,
      stars: repo.stars_count || 0,
      forks: repo.forks_count || 0,
      openIssues: repo.open_issues_count || 0,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(giteaRepositories)
        .set(repoData)
        .where(eq(giteaRepositories.giteaRepoId, String(repo.id)))
        .returning();
      syncedRepos.push(updated);
    } else {
      const [created] = await db.insert(giteaRepositories).values({
        giteaRepoId: String(repo.id),
        ...repoData,
        orgIntegrationId: integrationId,
      }).returning();
      syncedRepos.push(created);
    }
  }

  return syncedRepos;
}

async function syncGithubRepositories(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { token: string; org?: string }) {
  const endpoint = config.org 
    ? `https://api.github.com/orgs/${config.org}/repos?per_page=100`
    : 'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator';
  
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const repos = await response.json();
  
  const syncedRepos = [];
  for (const repo of repos) {
    const existing = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.githubRepoId, String(repo.id)))
      .limit(1);

    const repoData = {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || null,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      defaultBranch: repo.default_branch || 'main',
      owner: repo.owner?.login,
      private: repo.private || false,
      fork: repo.fork || false,
      archived: repo.archived || false,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      openIssues: repo.open_issues_count || 0,
      topics: repo.topics ? JSON.stringify(repo.topics) : null,
      language: repo.language || null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(githubRepositories)
        .set(repoData)
        .where(eq(githubRepositories.githubRepoId, String(repo.id)))
        .returning();
      syncedRepos.push(updated);
    } else {
      const [created] = await db.insert(githubRepositories).values({
        githubRepoId: String(repo.id),
        ...repoData,
        orgIntegrationId: integrationId,
      }).returning();
      syncedRepos.push(created);
    }
  }

  return syncedRepos;
}

async function syncK3sDeployments(db: NonNullable<Awaited<ReturnType<typeof getDbAsync>>>, integrationId: string, config: { apiUrl: string; token: string; clusterName?: string }) {
  const namespaces = ['default', 'production', 'staging', 'kube-system'];
  const syncedDeployments = [];

  for (const namespace of namespaces) {
    try {
      const response = await fetch(`${config.apiUrl}/apis/apps/v1/namespaces/${namespace}/deployments`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) continue;
        throw new Error(`K3s API error for ${namespace}: ${response.statusText}`);
      }

      const data = await response.json();
      const deployments = data.items || [];

      for (const deployment of deployments) {
        const deploymentId = `${namespace}/${deployment.metadata.name}`;
        const existing = await db
          .select()
          .from(k3sDeployments)
          .where(eq(k3sDeployments.k3sDeploymentId, deploymentId))
          .limit(1);

        const container = deployment.spec?.template?.spec?.containers?.[0];
        const deploymentData = {
          name: deployment.metadata.name,
          namespace,
          clusterName: config.clusterName || 'default',
          kind: 'Deployment',
          replicas: deployment.spec?.replicas || 1,
          readyReplicas: deployment.status?.readyReplicas || 0,
          image: container?.image || null,
          containerPort: container?.ports?.[0]?.containerPort || null,
          status: deployment.status?.readyReplicas === deployment.spec?.replicas ? 'running' : 'pending',
          updatedAt: new Date(),
        };

        if (existing.length > 0) {
          const [updated] = await db
            .update(k3sDeployments)
            .set(deploymentData)
            .where(eq(k3sDeployments.k3sDeploymentId, deploymentId))
            .returning();
          syncedDeployments.push(updated);
        } else {
          const [created] = await db.insert(k3sDeployments).values({
            k3sDeploymentId: deploymentId,
            ...deploymentData,
            orgIntegrationId: integrationId,
          }).returning();
          syncedDeployments.push(created);
        }
      }
    } catch (err) {
      console.error(`Error syncing namespace ${namespace}:`, err);
    }
  }

  return syncedDeployments;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    let isAuthorized = false;
    
    if (apiKey) {
      const validation = await validateApiKey(db, apiKey);
      isAuthorized = validation.valid;
    } else {
      const session = await getServerSession(authOptions);
      isAuthorized = !!session?.user;
    }
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        case 'gitea':
          syncedProjects = await syncGiteaRepositories(db, id, { token: credentials.token, baseUrl: config.baseUrl || 'https://git.gmac.io' });
          break;
        case 'github':
          syncedProjects = await syncGithubRepositories(db, id, { token: credentials.token, org: config.org });
          break;
        case 'k3s':
        case 'hetzner':
          if (credentials.k3sToken && config.k3sApiUrl) {
            syncedProjects = await syncK3sDeployments(db, id, { apiUrl: config.k3sApiUrl, token: credentials.k3sToken, clusterName: config.clusterName });
          } else {
            return NextResponse.json(
              { error: 'K3s credentials not configured for this integration' },
              { status: 400 }
            );
          }
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

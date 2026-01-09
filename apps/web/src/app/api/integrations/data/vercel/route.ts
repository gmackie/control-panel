import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';
import { VercelClient } from '@/lib/vercel/client';

async function getVercelCredentials() {
  const envToken = process.env.VERCEL_TOKEN;
  if (envToken) {
    return { token: envToken, teamId: process.env.VERCEL_TEAM_ID };
  }

  const db = await getDbAsync();
  if (!db) return null;

  const [integration] = await db
    .select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.provider, 'vercel'))
    .limit(1);

  if (!integration?.credentials) return null;

  const credentials = JSON.parse(integration.credentials);
  const config = integration.config ? JSON.parse(integration.config) : {};

  return { token: credentials.token, teamId: config.teamId };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = await getVercelCredentials();
    if (!creds?.token) {
      return NextResponse.json(
        { error: 'Vercel not configured. Add integration in Integrations Hub.' },
        { status: 404 }
      );
    }

    const client = new VercelClient({ token: creds.token, teamId: creds.teamId });

    const [projectsRes, deploymentsRes, user] = await Promise.all([
      client.listProjects(50),
      client.listDeployments({ limit: 30 }),
      client.getCurrentUser(),
    ]);

    const projects = projectsRes.projects;
    const deployments = deploymentsRes.deployments;

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    const recentDeployments = deployments.filter(d => d.created > last24h);
    const failedDeployments = deployments.filter(d => d.state === 'ERROR');
    const productionDeployments = deployments.filter(d => d.target === 'production');

    return NextResponse.json({
      user: user.user,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        framework: p.framework,
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
        link: p.link ? {
          type: p.link.type,
          repo: p.link.repo,
          org: p.link.org,
          productionBranch: p.link.productionBranch,
        } : null,
      })),
      deployments: deployments.map(d => ({
        uid: d.uid,
        name: d.name,
        url: d.url,
        state: d.state,
        target: d.target,
        created: d.created,
        ready: d.ready,
        meta: d.meta,
        creator: d.creator,
      })),
      summary: {
        totalProjects: projects.length,
        totalDeployments: deployments.length,
        deploymentsLast24h: recentDeployments.length,
        failedDeployments: failedDeployments.length,
        productionDeployments: productionDeployments.length,
        successRate: deployments.length > 0
          ? Math.round((deployments.length - failedDeployments.length) / deployments.length * 100)
          : 100,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Vercel data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Vercel data' },
      { status: 500 }
    );
  }
}

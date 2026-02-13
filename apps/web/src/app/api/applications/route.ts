import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApplication, getApplications } from '@/lib/applications/manager';
import { getDbAsync } from '@/lib/db';
import { devFixtureApplications } from '@/lib/dev-fixtures';
import { appIntegrations, applications, desc, k3sDeployments, inArray } from '@repo/db';

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true')

function safeJson<T>(value: T): T {
  // Remove undefined values to satisfy undici/NextResponse.json serializer
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T
}

function safeParseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function inferEnvironmentForList(deployments: { namespace: string | null }[]): 'development' | 'staging' | 'production' {
  let hasProduction = false;
  let hasStaging = false;

  for (const dep of deployments) {
    const ns = dep.namespace ?? '';
    if (!ns) continue;
    const isStaging =
      ns === 'staging' ||
      ns.includes('-staging') ||
      ns.includes('-beta') ||
      ns.includes('-dev');
    const isDevelopment = ns === 'development';

    if (isDevelopment) continue;
    if (isStaging) {
      hasStaging = true;
    } else {
      hasProduction = true;
    }
  }

  if (hasProduction) return 'production';
  if (hasStaging) return 'staging';
  return 'development';
}

export async function GET() {
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    
    if (db) {
      try {
        // Use Neon database
        const apps = await db
          .select()
          .from(applications)
          .orderBy(desc(applications.createdAt));

        const appIds = apps.map((app) => app.id);
        const [integrations, deployments] = appIds.length
          ? await Promise.all([
              db.select().from(appIntegrations).where(inArray(appIntegrations.applicationId, appIds)),
              db.select().from(k3sDeployments).where(inArray(k3sDeployments.applicationId, appIds)),
            ])
          : [[], []];

        const integrationsByAppId = new Map<string, typeof integrations>();
        for (const integration of integrations) {
          const existing = integrationsByAppId.get(integration.applicationId) ?? [];
          existing.push(integration);
          integrationsByAppId.set(integration.applicationId, existing);
        }

        const deploymentsByAppId = new Map<string, typeof deployments>();
        for (const dep of deployments) {
          if (!dep.applicationId) continue;
          const existing = deploymentsByAppId.get(dep.applicationId) ?? [];
          existing.push(dep);
          deploymentsByAppId.set(dep.applicationId, existing);
        }

        const applicationsList = apps.map((app) => {
          const appIntegrationsList = integrationsByAppId.get(app.id) ?? [];
          const appDeploymentsList = deploymentsByAppId.get(app.id) ?? [];

          const env = inferEnvironmentForList(appDeploymentsList.map((d) => ({ namespace: d.namespace })));

          return {
            id: app.id,
            name: app.name,
            description: app.description || '',
            slug: app.slug,
            productId: app.productId,
            repositoryUrl: app.repositoryUrl,
            status: app.status,
            gitProvider: app.gitProvider,
            deployProvider: app.deployProvider,
            dbProvider: app.dbProvider,
            apiKeys: [],
            secrets: [],
            integrations: appIntegrationsList.map((integration) => ({
              id: integration.id,
              provider: integration.provider,
              name: integration.name,
              enabled: integration.enabled,
              config: safeParseJson(integration.config),
              secrets: [],
              status: integration.enabled ? 'connected' : 'disconnected',
              lastSyncAt: integration.updatedAt?.toISOString(),
            })),
            settings: {
              environment: env,
              features: {},
              autoDeployEnabled: false,
            },
            createdAt: app.createdAt.toISOString(),
            updatedAt: app.updatedAt.toISOString(),
            ownerId: 'gmackie',
          };
        });
        return NextResponse.json(safeJson(applicationsList));
      } catch (err) {
        // Common local-dev case: DB configured but migrations not applied.
        if (authBypassEnabled) {
          const fallback = devFixtureApplications.map((app) => ({
            id: app.id,
            name: app.name,
            description: app.description,
            slug: app.slug,
            productId: app.productId ?? null,
            repositoryUrl: app.repositoryUrl ?? null,
            status: app.status ?? 'active',
            gitProvider: app.gitProvider ?? null,
            deployProvider: app.deployProvider ?? null,
            dbProvider: app.dbProvider ?? null,
            apiKeys: [],
            secrets: [],
            integrations: [],
            settings: {
              environment: 'development',
              features: {},
              autoDeployEnabled: false,
            },
            createdAt: app.createdAt ?? new Date().toISOString(),
            updatedAt: app.updatedAt ?? new Date().toISOString(),
            ownerId: 'local-dev',
          }));
          return NextResponse.json(safeJson(fallback));
        }
        throw err;
      }
    }
    
    // Fallback to in-memory (legacy behavior)
    const userId = authBypassEnabled
      ? 'local-dev'
      : (session!.user as { login?: string }).login || session!.user.email!;
    const appList = await getApplications(userId);
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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { applications, k3sDeployments, eq, and } from '@repo/db';
import { getK8sClient } from '@/lib/cluster/k8s-api-client';
import { validateApiKey } from '@repo/api';

const SYSTEM_NAMESPACES = [
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'default',
  'cert-manager',
  'ingress-nginx',
  'longhorn-system',
  'monitoring',
  'argocd',
  'kubernetes-dashboard',
  'registry',
];

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/-staging$|-beta$|-dev$|-prod$|-production$/, '')
    .replace(/[^a-z0-9-]/g, '-');
}

function inferEnvironment(namespace: string): 'production' | 'staging' | 'development' {
  const lower = namespace.toLowerCase();
  if (lower.includes('-staging') || lower.includes('-beta')) return 'staging';
  if (lower.includes('-dev') || lower === 'development') return 'development';
  return 'production';
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const internalKey = request.headers.get('x-internal-key');
    
    let isAuthorized = false;
    
    if (internalKey === process.env.NEXTAUTH_SECRET) {
      isAuthorized = true;
    } else if (apiKey) {
      const validation = await validateApiKey(db, apiKey);
      isAuthorized = validation.valid;
    } else {
      const session = await getServerSession(authOptions);
      isAuthorized = !!session?.user;
    }
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { linkToApplications = true, syncIntegrations = true } = body;

    const k8sClient = getK8sClient();
    if (!k8sClient) {
      return NextResponse.json({ error: 'K8s client not configured' }, { status: 500 });
    }

    const results = {
      namespacesScanned: 0,
      deploymentsDiscovered: 0,
      deploymentsCreated: 0,
      deploymentsUpdated: 0,
      applicationsLinked: 0,
      integrationsDetected: 0,
      errors: [] as string[],
      deployments: [] as Array<{
        namespace: string;
        name: string;
        image: string | null;
        replicas: number;
        status: string;
        applicationId: string | null;
        applicationName: string | null;
        environment: string;
        integrations: string[];
      }>,
    };

    const namespaces = await k8sClient.getNamespaces();
    const allApps = await db.select().from(applications).where(eq(applications.status, 'active'));
    
    const appsBySlug = new Map<string, typeof allApps[0]>();
    for (const app of allApps) {
      appsBySlug.set(app.slug.toLowerCase(), app);
      appsBySlug.set(normalizeSlug(app.slug), app);
    }

    for (const ns of namespaces) {
      const nsName = ns.metadata.name;
      
      if (SYSTEM_NAMESPACES.includes(nsName)) continue;
      
      results.namespacesScanned++;
      
      try {
        const deployments = await k8sClient.getDeployments(nsName);
        
        for (const deployment of deployments) {
          results.deploymentsDiscovered++;
          
          const deploymentId = `${nsName}/${deployment.metadata.name}`;
          const image = deployment.spec?.template?.spec?.containers?.[0]?.image || null;
          const replicas = deployment.spec?.replicas || 1;
          const readyReplicas = deployment.status?.readyReplicas || 0;
          const status = readyReplicas >= replicas ? 'running' : 'pending';
          const containerPort = deployment.spec?.template?.spec?.containers?.[0]?.ports?.[0]?.containerPort;
          const environment = inferEnvironment(nsName);
          
          let matchedApp: typeof allApps[0] | undefined;
          if (linkToApplications) {
            matchedApp = appsBySlug.get(nsName.toLowerCase()) 
              || appsBySlug.get(normalizeSlug(nsName))
              || appsBySlug.get(deployment.metadata.name.toLowerCase())
              || appsBySlug.get(normalizeSlug(deployment.metadata.name));
          }

          const existing = await db.select()
            .from(k3sDeployments)
            .where(eq(k3sDeployments.k3sDeploymentId, deploymentId))
            .limit(1);

          if (existing.length > 0) {
            await db.update(k3sDeployments)
              .set({
                name: deployment.metadata.name,
                image,
                replicas,
                readyReplicas,
                status,
                containerPort,
                applicationId: matchedApp?.id || existing[0].applicationId,
                updatedAt: new Date(),
              })
              .where(eq(k3sDeployments.id, existing[0].id));
            results.deploymentsUpdated++;
            
            if (matchedApp && !existing[0].applicationId) {
              results.applicationsLinked++;
            }
          } else {
            await db.insert(k3sDeployments).values({
              k3sDeploymentId: deploymentId,
              name: deployment.metadata.name,
              namespace: nsName,
              clusterName: 'default',
              kind: 'Deployment',
              image,
              replicas,
              readyReplicas,
              status,
              containerPort,
              applicationId: matchedApp?.id,
            });
            results.deploymentsCreated++;
            
            if (matchedApp) {
              results.applicationsLinked++;
            }
          }

          let integrations: string[] = [];
          if (syncIntegrations) {
            try {
              const secrets = await k8sClient.getSecrets(nsName);
              const allKeys: string[] = [];
              for (const secret of secrets) {
                if (secret.type === 'Opaque' && secret.data) {
                  allKeys.push(...Object.keys(secret.data));
                }
              }
              integrations = detectIntegrationProviders(allKeys);
              results.integrationsDetected += integrations.length;
            } catch (secretsError) {
              results.errors.push(`Secrets access restricted for ${nsName}`);
            }
          }

          results.deployments.push({
            namespace: nsName,
            name: deployment.metadata.name,
            image,
            replicas,
            status,
            applicationId: matchedApp?.id || null,
            applicationName: matchedApp?.name || null,
            environment,
            integrations,
          });
        }
      } catch (err) {
        results.errors.push(`Failed to scan ${nsName}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error discovering K8s deployments:', error);
    return NextResponse.json(
      { error: 'Failed to discover K8s deployments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function detectIntegrationProviders(keys: string[]): string[] {
  const providers = new Set<string>();
  const prefixes: Record<string, string> = {
    'CLERK_': 'clerk',
    'NEXT_PUBLIC_CLERK_': 'clerk',
    'STRIPE_': 'stripe',
    'TURSO_': 'turso',
    'NEON_': 'neon',
    'DATABASE_URL': 'database',
    'SUPABASE_': 'supabase',
    'SENTRY_': 'sentry',
    'POSTHOG_': 'posthog',
    'OPENAI_': 'openai',
    'OPENROUTER_': 'openrouter',
    'RESEND_': 'resend',
    'UPSTASH_': 'upstash',
  };

  for (const key of keys) {
    for (const [prefix, provider] of Object.entries(prefixes)) {
      if (key.startsWith(prefix) || key === prefix.replace(/_$/, '')) {
        providers.add(provider);
        break;
      }
    }
  }

  return Array.from(providers);
}

export async function GET(request: NextRequest) {
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ linkToApplications: true, syncIntegrations: true }),
  });
  return POST(postRequest);
}

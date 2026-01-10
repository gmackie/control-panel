import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { applications, appIntegrations, k3sDeployments, eq, and } from '@repo/db';
import { getK8sClient } from '@/lib/cluster/k8s-api-client';
import { validateApiKey } from '@repo/api';

const INTEGRATION_PREFIXES: Record<string, { name: string; provider: string }> = {
  CLERK_: { name: 'Clerk Auth', provider: 'clerk' },
  NEXT_PUBLIC_CLERK_: { name: 'Clerk Auth', provider: 'clerk' },
  STRIPE_: { name: 'Stripe Payments', provider: 'stripe' },
  NEXT_PUBLIC_STRIPE_: { name: 'Stripe Payments', provider: 'stripe' },
  TURSO_: { name: 'Turso Database', provider: 'turso' },
  NEON_: { name: 'Neon Database', provider: 'neon' },
  DATABASE_URL: { name: 'Database', provider: 'database' },
  SUPABASE_: { name: 'Supabase', provider: 'supabase' },
  SENTRY_: { name: 'Sentry', provider: 'sentry' },
  POSTHOG_: { name: 'PostHog Analytics', provider: 'posthog' },
  OPENAI_: { name: 'OpenAI', provider: 'openai' },
  OPENROUTER_: { name: 'OpenRouter', provider: 'openrouter' },
  ELEVENLABS_: { name: 'ElevenLabs', provider: 'elevenlabs' },
  SENDGRID_: { name: 'SendGrid Email', provider: 'sendgrid' },
  TWILIO_: { name: 'Twilio', provider: 'twilio' },
  AWS_: { name: 'AWS', provider: 'aws' },
  RESEND_: { name: 'Resend Email', provider: 'resend' },
  UPSTASH_: { name: 'Upstash Redis', provider: 'upstash' },
  REDIS_: { name: 'Redis', provider: 'redis' },
};

function detectIntegrationsFromSecretKeys(keys: string[]): Array<{ provider: string; name: string; envVars: string[] }> {
  const integrations = new Map<string, { provider: string; name: string; envVars: string[] }>();

  for (const key of keys) {
    for (const [prefix, info] of Object.entries(INTEGRATION_PREFIXES)) {
      if (key.startsWith(prefix) || key === prefix.replace(/_$/, '')) {
        const existing = integrations.get(info.provider);
        if (existing) {
          existing.envVars.push(key);
        } else {
          integrations.set(info.provider, { ...info, envVars: [key] });
        }
        break;
      }
    }
  }

  return Array.from(integrations.values());
}

function inferEnvironmentFromNamespace(namespace: string, appSlug: string): 'production' | 'staging' {
  const lowerNs = namespace.toLowerCase();
  if (lowerNs.includes('-staging') || lowerNs.includes('-beta') || lowerNs.includes('-dev')) {
    return 'staging';
  }
  if (lowerNs.endsWith('-staging') || lowerNs === 'staging') {
    return 'staging';
  }
  return 'production';
}

function matchNamespaceToSlug(namespace: string, slug: string): boolean {
  const normalizedNs = namespace.toLowerCase().replace(/-staging$|-beta$|-dev$/, '');
  const normalizedSlug = slug.toLowerCase();
  return normalizedNs === normalizedSlug || 
         namespace.toLowerCase() === normalizedSlug ||
         namespace.toLowerCase().startsWith(normalizedSlug + '-');
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
    const targetAppId = body.applicationId as string | undefined;

    const k8sClient = getK8sClient();
    if (!k8sClient) {
      return NextResponse.json({ error: 'K8s client not configured' }, { status: 500 });
    }

    const allApps = targetAppId
      ? await db.select().from(applications).where(eq(applications.id, targetAppId))
      : await db.select().from(applications).where(eq(applications.status, 'active'));

    const allDeployments = await db.select().from(k3sDeployments);
    
    const results = {
      applicationsProcessed: 0,
      integrationsCreated: 0,
      integrationsUpdated: 0,
      deploymentsLinked: 0,
      errors: [] as string[],
      details: [] as Array<{
        applicationId: string;
        applicationName: string;
        namespace: string;
        environment: string;
        integrations: string[];
      }>,
    };

    for (const app of allApps) {
      const matchingDeployments = allDeployments.filter(d => 
        matchNamespaceToSlug(d.namespace, app.slug)
      );

      if (matchingDeployments.length === 0) continue;

      results.applicationsProcessed++;

      for (const deployment of matchingDeployments) {
        const environment = inferEnvironmentFromNamespace(deployment.namespace, app.slug);
        
        if (!deployment.applicationId) {
          await db.update(k3sDeployments)
            .set({ applicationId: app.id, updatedAt: new Date() })
            .where(eq(k3sDeployments.id, deployment.id));
          results.deploymentsLinked++;
        }

        try {
          const secrets = await k8sClient.getSecrets(deployment.namespace);
          const allSecretKeys: string[] = [];
          
          for (const secret of secrets) {
            if (secret.type === 'Opaque' && secret.data) {
              allSecretKeys.push(...Object.keys(secret.data));
            }
          }

          const detected = detectIntegrationsFromSecretKeys(allSecretKeys);
          const integrationNames: string[] = [];

          for (const integration of detected) {
            const existing = await db.select()
              .from(appIntegrations)
              .where(and(
                eq(appIntegrations.applicationId, app.id),
                eq(appIntegrations.provider, integration.provider),
                eq(appIntegrations.environment, environment)
              ))
              .limit(1);

            if (existing.length > 0) {
              await db.update(appIntegrations)
                .set({
                  k8sDeploymentId: deployment.id,
                  k8sNamespace: deployment.namespace,
                  detectedFromK8s: true,
                  config: JSON.stringify({ envVars: integration.envVars }),
                  updatedAt: new Date(),
                })
                .where(eq(appIntegrations.id, existing[0].id));
              results.integrationsUpdated++;
            } else {
              await db.insert(appIntegrations).values({
                applicationId: app.id,
                provider: integration.provider,
                name: integration.name,
                environment,
                k8sDeploymentId: deployment.id,
                k8sNamespace: deployment.namespace,
                detectedFromK8s: true,
                config: JSON.stringify({ envVars: integration.envVars }),
                enabled: true,
              });
              results.integrationsCreated++;
            }
            integrationNames.push(integration.provider);
          }

          if (integrationNames.length > 0) {
            results.details.push({
              applicationId: app.id,
              applicationName: app.name,
              namespace: deployment.namespace,
              environment,
              integrations: integrationNames,
            });
          }
        } catch (err) {
          results.errors.push(`Failed to get secrets for ${deployment.namespace}: ${err}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error syncing K8s integrations:', error);
    return NextResponse.json(
      { error: 'Failed to sync K8s integrations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getK8sClient } from '@/lib/cluster/k8s-api-client';

const INTEGRATION_PREFIXES: Record<string, { name: string; icon: string }> = {
  CLERK_: { name: 'Clerk', icon: 'clerk' },
  NEXT_PUBLIC_CLERK_: { name: 'Clerk', icon: 'clerk' },
  STRIPE_: { name: 'Stripe', icon: 'stripe' },
  TURSO_: { name: 'Turso', icon: 'turso' },
  NEON_: { name: 'Neon', icon: 'neon' },
  SUPABASE_: { name: 'Supabase', icon: 'supabase' },
  SENTRY_: { name: 'Sentry', icon: 'sentry' },
  POSTHOG_: { name: 'PostHog', icon: 'posthog' },
  OPENAI_: { name: 'OpenAI', icon: 'openai' },
  OPENROUTER_: { name: 'OpenRouter', icon: 'openrouter' },
  ELEVENLABS_: { name: 'ElevenLabs', icon: 'elevenlabs' },
  SENDGRID_: { name: 'SendGrid', icon: 'sendgrid' },
  TWILIO_: { name: 'Twilio', icon: 'twilio' },
  AWS_: { name: 'AWS', icon: 'aws' },
  RESEND_: { name: 'Resend', icon: 'resend' },
  UPSTASH_: { name: 'Upstash', icon: 'upstash' },
  VERCEL_: { name: 'Vercel', icon: 'vercel' },
};

function detectIntegrationsFromEnvVars(envKeys: string[]): Array<{ name: string; icon: string; envVars: string[] }> {
  const integrations = new Map<string, { name: string; icon: string; envVars: string[] }>();

  for (const key of envKeys) {
    for (const [prefix, info] of Object.entries(INTEGRATION_PREFIXES)) {
      if (key.startsWith(prefix)) {
        const existing = integrations.get(info.name);
        if (existing) {
          existing.envVars.push(key);
        } else {
          integrations.set(info.name, { ...info, envVars: [key] });
        }
        break;
      }
    }
  }

  return Array.from(integrations.values());
}

function decodeSecretKeys(data: Record<string, string> | undefined): string[] {
  if (!data) return [];
  return Object.keys(data);
}

interface RouteParams {
  params: Promise<{ namespace: string; name: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace, name } = await params;

    const k8sClient = getK8sClient();
    if (!k8sClient) {
      return NextResponse.json({ error: 'K8s client not configured' }, { status: 500 });
    }

    const [deployment, ingresses, secrets] = await Promise.all([
      k8sClient.getDeployment(namespace, name),
      k8sClient.getIngresses(namespace),
      k8sClient.getSecrets(namespace),
    ]);

    const matchingIngress = ingresses.find(
      ing =>
        ing.metadata.name === name ||
        ing.metadata.name.includes(name) ||
        ing.spec?.rules?.some(rule =>
          rule.http?.paths?.some(path => path.backend.service.name === name)
        )
    );

    const containers = deployment.spec?.template?.spec?.containers || [];
    const mainContainer = containers[0];

    const allEnvKeys: string[] = [];
    for (const container of containers) {
      const envVars = (container as any).env || [];
      const envFromRefs = (container as any).envFrom || [];

      for (const env of envVars) {
        if (env.name) allEnvKeys.push(env.name);
      }

      for (const envFrom of envFromRefs) {
        if (envFrom.secretRef?.name) {
          const secret = secrets.find(s => s.metadata.name === envFrom.secretRef.name);
          if (secret?.data) {
            allEnvKeys.push(...decodeSecretKeys(secret.data));
          }
        }
      }
    }

    const detectedIntegrations = detectIntegrationsFromEnvVars(allEnvKeys);

    const secretNames = secrets
      .filter(s => s.type === 'Opaque' || s.type === 'kubernetes.io/tls')
      .map(s => ({
        name: s.metadata.name,
        type: s.type,
        keyCount: s.data ? Object.keys(s.data).length : 0,
      }));

    const result = {
      deployment: {
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        labels: deployment.metadata.labels,
        annotations: deployment.metadata.annotations,
        createdAt: deployment.metadata.creationTimestamp,
        replicas: deployment.spec?.replicas || 1,
        readyReplicas: deployment.status?.readyReplicas || 0,
        availableReplicas: deployment.status?.availableReplicas || 0,
      },
      container: mainContainer
        ? {
            name: mainContainer.name,
            image: mainContainer.image,
            ports: mainContainer.ports,
            resources: mainContainer.resources,
          }
        : null,
      ingress: matchingIngress
        ? {
            name: matchingIngress.metadata.name,
            host: matchingIngress.spec?.rules?.[0]?.host,
            tls: matchingIngress.spec?.tls?.[0]
              ? {
                  hosts: matchingIngress.spec.tls[0].hosts,
                  secretName: matchingIngress.spec.tls[0].secretName,
                }
              : null,
            paths:
              matchingIngress.spec?.rules?.[0]?.http?.paths?.map(p => ({
                path: p.path,
                service: p.backend.service.name,
                port: p.backend.service.port.number,
              })) || [],
          }
        : null,
      detectedIntegrations,
      secrets: secretNames,
      envVarCount: allEnvKeys.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching deployment details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

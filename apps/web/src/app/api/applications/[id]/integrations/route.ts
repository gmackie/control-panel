import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { appIntegrations, applications, eq, and } from '@repo/db';

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true')

interface Params {
  params: Promise<{ id: string }>;
}

function safeJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

const APP_PROVIDERS = ['aws', 'clerk', 'elevenlabs', 'neon', 'openrouter', 'planetscale', 'posthog', 'resend', 'sendgrid', 'sentry', 'stripe', 'supabase', 'twilio', 'turso', 'upstash'] as const;

type UiIntegration = {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  status: 'connected' | 'error' | 'not_configured';
  config: Record<string, unknown> | null;
  secrets: string[];
  createdAt: string;
  updatedAt: string;
};

const devIntegrationStore: Map<string, Map<string, UiIntegration>> = new Map();

function getDevStore(appId: string): Map<string, UiIntegration> {
  const existing = devIntegrationStore.get(appId);
  if (existing) return existing;
  const created = new Map<string, UiIntegration>();
  devIntegrationStore.set(appId, created);
  return created;
}

function transformIntegrationForUI(integration: typeof appIntegrations.$inferSelect) {
  const config = integration.config ? JSON.parse(integration.config) : null;
  const credentials = integration.credentials ? JSON.parse(integration.credentials) : null;
  
  const configured = !!(credentials && Object.keys(credentials).length > 0);
  
  let status: 'connected' | 'error' | 'not_configured' = 'not_configured';
  if (configured) {
    status = integration.enabled ? 'connected' : 'error';
  }
  
  return {
    id: integration.id,
    provider: integration.provider,
    name: integration.name,
    enabled: integration.enabled,
    configured,
    status,
    config,
    secrets: credentials ? Object.keys(credentials) : [], // Only expose key names, not values (security)
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

function safeParseObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authBypassEnabled) {
      const store = getDevStore(params.id);
      return NextResponse.json(safeJson(Array.from(store.values())));
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id))
      .limit(1);

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const integrations = await db
      .select()
      .from(appIntegrations)
      .where(eq(appIntegrations.applicationId, params.id));

    const enrichedIntegrations = integrations.map(transformIntegrationForUI);

    return NextResponse.json(safeJson(enrichedIntegrations));
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authBypassEnabled) {
      const body = await request.json();
      const { provider, name, enabled, config, credentials } = body;

      if (!provider || !APP_PROVIDERS.includes(provider)) {
        return NextResponse.json(
          { error: `Invalid provider. Supported: ${APP_PROVIDERS.join(', ')}` },
          { status: 400 }
        );
      }

      const store = getDevStore(params.id);
      const existing = store.get(provider);
      const now = new Date().toISOString();
      const nextConfig = {
        ...(existing?.config ?? {}),
        ...(config && typeof config === 'object' ? (config as Record<string, unknown>) : {}),
      };
      const nextCredentials = {
        ...(existing ? Object.fromEntries((existing.secrets ?? []).map((k) => [k, '***'])) : {}),
        ...(credentials && typeof credentials === 'object' ? (credentials as Record<string, unknown>) : {}),
      };
      const secrets = Object.keys(nextCredentials);
      const configured = secrets.length > 0;
      const isEnabled = enabled ?? existing?.enabled ?? true;
      const status: UiIntegration['status'] = configured ? (isEnabled ? 'connected' : 'error') : 'not_configured';

      const saved: UiIntegration = {
        id: existing?.id ?? `dev-${params.id}-${provider}`,
        provider,
        name: name ?? existing?.name ?? provider.charAt(0).toUpperCase() + provider.slice(1),
        enabled: isEnabled,
        configured,
        status,
        config: Object.keys(nextConfig).length > 0 ? nextConfig : null,
        secrets,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      store.set(provider, saved);
      return NextResponse.json(safeJson(saved), { status: existing ? 200 : 201 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id))
      .limit(1);

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const body = await request.json();
    const { provider, name, enabled, config, credentials } = body;

    if (!provider || !APP_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Supported: ${APP_PROVIDERS.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(appIntegrations)
      .where(and(
        eq(appIntegrations.applicationId, params.id),
        eq(appIntegrations.provider, provider)
      ))
      .limit(1);

    if (existing.length > 0) {
      const existingConfig = safeParseObject(existing[0].config);
      const existingCredentials = safeParseObject(existing[0].credentials);

      const mergedConfig = config
        ? { ...existingConfig, ...(config as Record<string, unknown>) }
        : existingConfig;

      const mergedCredentials = credentials
        ? { ...existingCredentials, ...(credentials as Record<string, unknown>) }
        : existingCredentials;

      const [updated] = await db
        .update(appIntegrations)
        .set({
          name: name ?? existing[0].name,
          enabled: enabled ?? existing[0].enabled,
          config: config ? JSON.stringify(mergedConfig) : existing[0].config,
          credentials: credentials ? JSON.stringify(mergedCredentials) : existing[0].credentials,
          updatedAt: new Date(),
        })
        .where(eq(appIntegrations.id, existing[0].id))
        .returning();

      return NextResponse.json(safeJson(transformIntegrationForUI(updated)));
    }

    const [newIntegration] = await db.insert(appIntegrations).values({
      applicationId: params.id,
      provider,
      name: name || provider.charAt(0).toUpperCase() + provider.slice(1),
      enabled: enabled ?? true,
      config: config ? JSON.stringify(config) : null,
      credentials: credentials ? JSON.stringify(credentials) : null,
    }).returning();

    return NextResponse.json(safeJson(transformIntegrationForUI(newIntegration)), { status: 201 });
  } catch (error) {
    console.error('Error saving integration:', error);
    return NextResponse.json(
      { error: 'Failed to save integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authBypassEnabled) {
      const { searchParams } = new URL(request.url);
      const provider = searchParams.get('provider');
      const integrationId = searchParams.get('id');

      if (!provider && !integrationId) {
        return NextResponse.json(
          { error: 'Either provider or id query param is required' },
          { status: 400 }
        );
      }

      const store = getDevStore(params.id);
      if (provider) store.delete(provider);
      if (integrationId) {
        for (const [p, v] of store.entries()) {
          if (v.id === integrationId) store.delete(p);
        }
      }

      return NextResponse.json({ success: true });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const integrationId = searchParams.get('id');

    if (!provider && !integrationId) {
      return NextResponse.json(
        { error: 'Either provider or id query param is required' },
        { status: 400 }
      );
    }

    let deleted;
    if (integrationId) {
      deleted = await db
        .delete(appIntegrations)
        .where(and(
          eq(appIntegrations.id, integrationId),
          eq(appIntegrations.applicationId, params.id)
        ))
        .returning();
    } else {
      deleted = await db
        .delete(appIntegrations)
        .where(and(
          eq(appIntegrations.applicationId, params.id),
          eq(appIntegrations.provider, provider!)
        ))
        .returning();
    }

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

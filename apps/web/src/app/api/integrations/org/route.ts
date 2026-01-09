import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, vercelProjects, expoProjects, neonProjects, desc, eq } from '@repo/db';

function safeJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

const SUPPORTED_PROVIDERS = ['vercel', 'expo', 'neon', 'turso', 'github', 'gitea', 'hetzner', 'aws'] as const;
type Provider = typeof SUPPORTED_PROVIDERS[number];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    let query = db.select().from(orgIntegrations);
    
    if (provider && SUPPORTED_PROVIDERS.includes(provider as Provider)) {
      const integrations = await db
        .select()
        .from(orgIntegrations)
        .where(eq(orgIntegrations.provider, provider))
        .orderBy(desc(orgIntegrations.createdAt));
      return NextResponse.json(safeJson(integrations));
    }

    const integrations = await query.orderBy(desc(orgIntegrations.createdAt));
    return NextResponse.json(safeJson(integrations));
  } catch (error) {
    console.error('Error fetching org integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();

    if (!body.provider || !SUPPORTED_PROVIDERS.includes(body.provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Supported: ${SUPPORTED_PROVIDERS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.name) {
      return NextResponse.json(
        { error: 'Integration name is required' },
        { status: 400 }
      );
    }

    const [newIntegration] = await db.insert(orgIntegrations).values({
      provider: body.provider,
      name: body.name,
      description: body.description || null,
      enabled: body.enabled ?? true,
      config: body.config ? JSON.stringify(body.config) : null,
      credentials: body.credentials ? JSON.stringify(body.credentials) : null,
    }).returning();

    return NextResponse.json(safeJson({
      ...newIntegration,
      config: newIntegration.config ? JSON.parse(newIntegration.config) : null,
    }), { status: 201 });
  } catch (error) {
    console.error('Error creating org integration:', error);
    return NextResponse.json(
      { error: 'Failed to create integration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

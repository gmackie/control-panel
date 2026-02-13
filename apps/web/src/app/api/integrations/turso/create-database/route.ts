import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true');

export async function POST(request: NextRequest) {
  const session = authBypassEnabled ? null : await getServerSession(authOptions);
  if (!authBypassEnabled && !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const name =
    (body && typeof body === 'object' && 'name' in body
      ? String((body as Record<string, unknown>).name || '')
      : '').trim();
  const region =
    (body && typeof body === 'object' && 'region' in body
      ? String((body as Record<string, unknown>).region || '')
      : '').trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (authBypassEnabled) {
    return NextResponse.json({
      name,
      url: `libsql://${name}-local-dev.turso.io`,
      region: region || 'local',
      size: 0,
      tables: 0,
      created: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { error: 'Not implemented: create database requires Turso API integration' },
    { status: 501 }
  );
}

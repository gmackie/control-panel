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
  const databaseUrl =
    body && typeof body === 'object' && 'databaseUrl' in body ? String((body as Record<string, unknown>).databaseUrl || '') : '';
  const authToken =
    body && typeof body === 'object' && 'authToken' in body ? String((body as Record<string, unknown>).authToken || '') : '';

  if (!databaseUrl || !authToken) {
    return NextResponse.json({ error: 'databaseUrl and authToken are required' }, { status: 400 });
  }

  if (authBypassEnabled) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: 'Not implemented: Turso test connection requires a libsql client or Turso API integration' },
    { status: 501 }
  );
}

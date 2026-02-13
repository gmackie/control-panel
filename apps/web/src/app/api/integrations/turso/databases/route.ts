import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true');

export async function POST(_request: NextRequest) {
  const session = authBypassEnabled ? null : await getServerSession(authOptions);
  if (!authBypassEnabled && !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Minimal endpoint for TursoIntegrationForm; real implementation can be added later.
  return NextResponse.json([]);
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true');

type TursoValidationResult = {
  isValid: boolean;
  organization?: string;
  database?: {
    name: string;
    region: string;
    version: string;
    size: number;
  };
  stats?: {
    rowsRead: number;
    rowsWritten: number;
    storageBytes: number;
  };
  error?: string;
};

function inferDatabaseName(databaseUrl: string): string {
  // libsql://<db>-<org>.turso.io
  const match = databaseUrl.match(/^libsql:\/\/([^\.]+)\.turso\.io/i);
  if (match?.[1]) return match[1];
  return 'turso-db';
}

export async function POST(request: NextRequest) {
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ isValid: false, error: 'Unauthorized' } satisfies TursoValidationResult, { status: 401 });
    }

    const body = await request.json();
    const databaseUrl = String(body?.databaseUrl || '');
    const authToken = String(body?.authToken || '');

    if (!databaseUrl || !authToken) {
      return NextResponse.json(
        { isValid: false, error: 'databaseUrl and authToken are required' } satisfies TursoValidationResult,
        { status: 400 }
      );
    }

    if (authBypassEnabled) {
      return NextResponse.json({
        isValid: true,
        organization: 'local-dev',
        database: {
          name: inferDatabaseName(databaseUrl),
          region: 'local',
          version: 'unknown',
          size: 0,
        },
        stats: {
          rowsRead: 0,
          rowsWritten: 0,
          storageBytes: 0,
        },
      } satisfies TursoValidationResult);
    }

    return NextResponse.json(
      {
        isValid: false,
        error: 'Not implemented: Turso validation requires a libsql client or Turso API integration',
      } satisfies TursoValidationResult,
      { status: 501 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to validate connection',
      } satisfies TursoValidationResult,
      { status: 500 }
    );
  }
}

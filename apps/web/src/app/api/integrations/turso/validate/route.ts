import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { databaseUrl, authToken, applicationId } = await request.json();

    if (!databaseUrl || !authToken) {
      return NextResponse.json({
        isValid: false,
        error: 'Database URL and auth token are required',
      });
    }

    try {
      // Dynamically import libsql to avoid build issues in Alpine Linux
      const { createClient } = await import('@libsql/client');
      
      // Create a Turso client
      const client = createClient({
        url: databaseUrl,
        authToken: authToken,
      });

      // Try to execute a simple query to validate the connection
      const result = await client.execute('SELECT 1');
      
      // Get database info
      const dbInfo = await client.execute(`
        SELECT 
          (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as table_count,
          (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size
      `);

      // Parse the database URL to get the database name and region
      const urlParts = new URL(databaseUrl);
      const hostParts = urlParts.hostname.split('.');
      const dbName = hostParts[0];
      const region = hostParts[1] || 'unknown';

      // Get some basic stats
      let stats = {
        rowsRead: 0,
        rowsWritten: 0,
        storageBytes: 0,
      };

      if (dbInfo.rows.length > 0) {
        const row = dbInfo.rows[0];
        stats.storageBytes = Number(row.db_size) || 0;
      }

      await client.close();

      return NextResponse.json({
        isValid: true,
        organization: hostParts[hostParts.length - 3] || 'turso',
        database: {
          name: dbName,
          region: region,
          version: 'latest',
          size: stats.storageBytes,
        },
        stats,
      });
    } catch (error: any) {
      console.error('Turso validation error:', error);
      
      let errorMessage = 'Failed to connect to database';
      if (error.message?.includes('AUTH')) {
        errorMessage = 'Invalid auth token';
      } else if (error.message?.includes('URL')) {
        errorMessage = 'Invalid database URL format';
      } else if (error.message?.includes('NETWORK')) {
        errorMessage = 'Network error - check your connection';
      }

      return NextResponse.json({
        isValid: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error('Error validating Turso connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
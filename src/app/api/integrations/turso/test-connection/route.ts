import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { databaseUrl, authToken, applicationId } = await request.json();

    if (!databaseUrl || !authToken) {
      return NextResponse.json({ 
        error: 'Database URL and auth token are required' 
      }, { status: 400 });
    }

    try {
      const client = createClient({
        url: databaseUrl,
        authToken: authToken,
      });

      // Create a test table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS _turso_test_${Date.now()} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test_value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert test data
      const testValue = `test_${applicationId}_${Date.now()}`;
      const insertResult = await client.execute({
        sql: 'INSERT INTO _turso_test_' + Date.now() + ' (test_value) VALUES (?)',
        args: [testValue],
      });

      // Query the data back
      const selectResult = await client.execute(
        'SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"'
      );

      // Clean up - drop the test table
      await client.execute(`DROP TABLE IF EXISTS _turso_test_${Date.now()}`);

      await client.close();

      return NextResponse.json({
        success: true,
        message: 'Connection test successful',
        tableCount: selectResult.rows[0]?.count || 0,
        testWrite: insertResult.rowsAffected === 1,
      });
    } catch (error: any) {
      console.error('Turso test connection error:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to test connection' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error testing Turso connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
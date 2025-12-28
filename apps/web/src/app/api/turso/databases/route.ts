import { NextRequest, NextResponse } from 'next/server'
import { getTursoDatabaseStatus } from '@/lib/monitoring/turso-monitor'

export async function GET(request: NextRequest) {
  try {
    const databases = await getTursoDatabaseStatus();
    
    // Databases are already in the correct format from getTursoDatabaseStatus
    return NextResponse.json(databases);
  } catch (error) {
    console.error('Failed to fetch Turso databases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Turso databases' },
      { status: 500 }
    );
  }
}
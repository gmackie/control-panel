import { NextRequest, NextResponse } from 'next/server'
import { TursoDatabase } from '@/types'

// Mock Turso databases - replace with actual Turso API
export async function GET(request: NextRequest) {
  try {
    // In production, fetch from Turso API:
    // const turso = new Turso({ token: process.env.TURSO_TOKEN })
    // const databases = await turso.databases.list()
    
    const mockDatabases: TursoDatabase[] = [
      {
        id: 'db_1',
        name: 'prod-main',
        appId: 'app-1',
        location: 'iad',
        size: 5368709120, // 5GB
        connections: 23,
        operations: {
          reads: 1234567,
          writes: 234567,
        },
        status: 'healthy',
      },
      {
        id: 'db_2',
        name: 'prod-analytics',
        appId: 'api-2',
        location: 'iad',
        size: 10737418240, // 10GB
        connections: 15,
        operations: {
          reads: 2345678,
          writes: 123456,
        },
        status: 'healthy',
      },
      {
        id: 'db_3',
        name: 'staging-main',
        appId: 'app-2',
        location: 'sjc',
        size: 2147483648, // 2GB
        connections: 5,
        operations: {
          reads: 234567,
          writes: 34567,
        },
        status: 'warning',
      },
      {
        id: 'db_4',
        name: 'prod-users',
        appId: 'api-1',
        location: 'iad',
        size: 3221225472, // 3GB
        connections: 18,
        operations: {
          reads: 876543,
          writes: 87654,
        },
        status: 'healthy',
      },
      {
        id: 'db_5',
        name: 'prod-events',
        appId: 'worker-1',
        location: 'iad',
        size: 8589934592, // 8GB
        connections: 12,
        operations: {
          reads: 456789,
          writes: 345678,
        },
        status: 'healthy',
      },
      {
        id: 'db_6',
        name: 'dev-test',
        appId: 'app-3',
        location: 'fra',
        size: 536870912, // 512MB
        connections: 0,
        operations: {
          reads: 0,
          writes: 0,
        },
        status: 'error',
      },
    ]
    
    return NextResponse.json(mockDatabases)
  } catch (error) {
    console.error('Failed to fetch Turso databases:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Turso databases' },
      { status: 500 }
    )
  }
}
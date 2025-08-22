import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/types";

// Mock data - replace with actual database queries
const mockDatabases: Record<string, Database[]> = {
  "1": [
    {
      id: "1",
      serviceId: "1",
      name: "control-panel-db",
      type: "turso",
      provider: "turso",
      status: "healthy",
      connectionString: "libsql://control-panel-db.turso.io",
      size: 52428800, // 50MB
      connections: 12,
      operations: {
        reads: 150,
        writes: 25,
      },
      migrations: [
        {
          id: "1",
          databaseId: "1",
          version: "001",
          name: "create_users_table",
          status: "completed",
          appliedAt: new Date().toISOString(),
          duration: 120,
          sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT)",
          checksum: "abc123",
        },
        {
          id: "2",
          databaseId: "1",
          version: "002",
          name: "add_user_roles",
          status: "completed",
          appliedAt: new Date().toISOString(),
          duration: 85,
          sql: 'ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"',
          checksum: "def456",
        },
      ],
      backups: [
        {
          id: "1",
          databaseId: "1",
          name: "backup-2024-01-15",
          size: 52428800,
          status: "completed",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          location: "s3://backups/control-panel-db/2024-01-15.sql",
        },
      ],
      monitoring: {
        queries: [
          {
            sql: "SELECT * FROM users WHERE email = ?",
            count: 1250,
            avgTime: 2.5,
            maxTime: 15.2,
            lastExecuted: new Date().toISOString(),
          },
          {
            sql: "INSERT INTO users (email, name) VALUES (?, ?)",
            count: 45,
            avgTime: 1.8,
            maxTime: 8.9,
            lastExecuted: new Date().toISOString(),
          },
        ],
        connections: {
          active: 8,
          idle: 4,
          max: 20,
        },
        performance: {
          slowQueries: 2,
          deadlocks: 0,
          cacheHitRatio: 0.95,
        },
      },
    },
  ],
  "2": [
    {
      id: "2",
      serviceId: "2",
      name: "api-gateway-db",
      type: "postgresql",
      provider: "aws",
      status: "healthy",
      connectionString:
        "postgresql://user:pass@api-gateway-db.cluster.amazonaws.com:5432/api_gateway",
      size: 104857600, // 100MB
      connections: 25,
      operations: {
        reads: 500,
        writes: 100,
      },
      migrations: [],
      backups: [],
      monitoring: {
        queries: [],
        connections: {
          active: 15,
          idle: 10,
          max: 50,
        },
        performance: {
          slowQueries: 0,
          deadlocks: 0,
          cacheHitRatio: 0.98,
        },
      },
    },
  ],
  "3": [
    {
      id: "3",
      serviceId: "3",
      name: "worker-db",
      type: "turso",
      provider: "turso",
      status: "warning",
      connectionString: "libsql://worker-db.turso.io",
      size: 26214400, // 25MB
      connections: 5,
      operations: {
        reads: 75,
        writes: 150,
      },
      migrations: [
        {
          id: "3",
          databaseId: "3",
          version: "001",
          name: "create_jobs_table",
          status: "completed",
          appliedAt: new Date().toISOString(),
          duration: 95,
          sql: "CREATE TABLE jobs (id INTEGER PRIMARY KEY, type TEXT, status TEXT, created_at DATETIME)",
          checksum: "ghi789",
        },
      ],
      backups: [],
      monitoring: {
        queries: [
          {
            sql: "INSERT INTO jobs (type, status, created_at) VALUES (?, ?, ?)",
            count: 300,
            avgTime: 1.2,
            maxTime: 5.8,
            lastExecuted: new Date().toISOString(),
          },
        ],
        connections: {
          active: 3,
          idle: 2,
          max: 10,
        },
        performance: {
          slowQueries: 1,
          deadlocks: 0,
          cacheHitRatio: 0.92,
        },
      },
    },
  ],
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const databases = mockDatabases[params.id] || [];
    return NextResponse.json(databases);
  } catch (error) {
    console.error("Failed to fetch databases:", error);
    return NextResponse.json(
      { error: "Failed to fetch databases" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // In production, create database and configure connection
    const newDatabase: Database = {
      id: Date.now().toString(),
      serviceId: params.id,
      ...body,
      status: "creating",
      size: 0,
      connections: 0,
      operations: {
        reads: 0,
        writes: 0,
      },
      migrations: [],
      backups: [],
      monitoring: {
        queries: [],
        connections: {
          active: 0,
          idle: 0,
          max: 10,
        },
        performance: {
          slowQueries: 0,
          deadlocks: 0,
          cacheHitRatio: 0,
        },
      },
    };

    return NextResponse.json(newDatabase, { status: 201 });
  } catch (error) {
    console.error("Failed to create database:", error);
    return NextResponse.json(
      { error: "Failed to create database" },
      { status: 500 }
    );
  }
}

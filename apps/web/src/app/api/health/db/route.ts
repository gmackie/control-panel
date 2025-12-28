import { NextResponse } from "next/server";
import { checkPostgresHealth, isPostgresConfigured } from "@/lib/db/postgres";

/**
 * GET /api/health/db
 * 
 * Public endpoint for database health checks.
 * Returns PostgreSQL connection status and latency.
 * 
 * This endpoint is intentionally public for:
 * - Kubernetes liveness/readiness probes
 * - External monitoring systems
 * - Load balancer health checks
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  
  // Check if PostgreSQL is configured
  if (!isPostgresConfigured()) {
    return NextResponse.json({
      status: "unconfigured",
      database: "postgresql",
      configured: false,
      message: "PostgreSQL not configured (DATABASE_URL missing)",
      timestamp,
    }, { status: 503 });
  }
  
  try {
    const health = await checkPostgresHealth();
    
    if (health.healthy) {
      return NextResponse.json({
        status: "healthy",
        database: "postgresql",
        configured: true,
        connected: true,
        latencyMs: health.latencyMs,
        message: health.message,
        timestamp,
      });
    } else {
      return NextResponse.json({
        status: "unhealthy",
        database: "postgresql",
        configured: true,
        connected: false,
        latencyMs: health.latencyMs,
        message: health.message,
        timestamp,
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: "error",
      database: "postgresql",
      configured: true,
      connected: false,
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp,
    }, { status: 503 });
  }
}

// Also support HEAD requests for simple health checks
export async function HEAD() {
  if (!isPostgresConfigured()) {
    return new NextResponse(null, { status: 503 });
  }
  
  try {
    const health = await checkPostgresHealth();
    return new NextResponse(null, { status: health.healthy ? 200 : 503 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

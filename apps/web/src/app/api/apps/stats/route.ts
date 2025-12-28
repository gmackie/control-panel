import { NextResponse } from "next/server";
import { applicationsRepo, deploymentsRepo, commitsRepo, webhooksRepo } from "@/lib/db/repositories";
import { isPostgresConfigured } from "@/lib/db/postgres";
import type { Deployment } from "@/lib/schema-pg";

/**
 * GET /api/apps/stats
 * 
 * Returns aggregated statistics for the dashboard
 */
export async function GET() {
  try {
    if (!isPostgresConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Database not configured",
      }, { status: 503 });
    }
    
    // Get all stats in parallel
    const [
      applicationCount,
      applicationsByStatus,
      firingAlerts,
      recentDeployments,
    ] = await Promise.all([
      applicationsRepo.getCount(),
      applicationsRepo.getCountByStatus(),
      webhooksRepo.getFiringAlertsCount(),
      deploymentsRepo.getRecentDeployments(5),
    ]);
    
    // Calculate health percentages
    const totalApps = applicationCount || 1;
    const healthyApps = applicationsByStatus['healthy'] || 0;
    const degradedApps = applicationsByStatus['degraded'] || 0;
    const unhealthyApps = applicationsByStatus['unhealthy'] || 0;
    
    return NextResponse.json({
      success: true,
      data: {
        applications: {
          total: applicationCount,
          byStatus: applicationsByStatus,
          healthPercentage: Math.round((healthyApps / totalApps) * 100),
        },
        alerts: {
          firing: firingAlerts.total,
          critical: firingAlerts.critical,
          warning: firingAlerts.warning,
          info: firingAlerts.info,
        },
        deployments: {
          recent: recentDeployments.map((d: Deployment) => ({
            id: d.id,
            applicationId: d.applicationId,
            environment: d.environment,
            status: d.status,
            imageTag: d.imageTag,
            deployedBy: d.deployedBy,
            createdAt: d.createdAt,
          })),
        },
        summary: {
          totalApplications: applicationCount,
          healthyApplications: healthyApps,
          degradedApplications: degradedApps,
          unhealthyApplications: unhealthyApps,
          firingAlerts: firingAlerts.total,
          criticalAlerts: firingAlerts.critical,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

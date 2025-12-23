import { NextResponse } from "next/server";
import { getPostgresDb, schemaPg } from "@/lib/db/postgres";
import { desc, eq, sql, gte, or } from "drizzle-orm";

// Types for query results
interface PipelineQueryResult {
  id: string;
  applicationId: string;
  applicationName: string | null;
  workflowName: string;
  status: string;
  conclusion: string | null;
  branch: string;
  event: string;
  triggeredBy: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  duration: number | null;
  url: string | null;
}

interface DeploymentQueryResult {
  id: string;
  applicationId: string;
  applicationName: string | null;
  environment: string;
  status: string;
  imageTag: string;
  deployedBy: string | null;
  createdAt: Date;
  namespace: string;
}

/**
 * GET /api/apps/metrics/pipelines
 * 
 * Returns pipeline and deployment metrics for the CD Pipeline Status Widget
 */
export async function GET() {
  try {
    const db = await getPostgresDb();
    
    if (!db) {
      // Return empty data if database not available
      return NextResponse.json({
        success: true,
        data: {
          activePipelines: [],
          recentPipelines: [],
          recentDeployments: [],
          stats: {
            totalBuildsToday: 0,
            successRate: 0,
            avgBuildTime: 0,
            deploymentsToday: 0,
            stagingDeployments: 0,
            productionDeployments: 0,
          },
        },
        message: "Database not configured",
        timestamp: new Date().toISOString(),
      });
    }

    // Get start of today for filtering
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Fetch active pipelines (running or pending)
    const activePipelines = await db
      .select({
        id: schemaPg.pipelineRuns.id,
        applicationId: schemaPg.pipelineRuns.applicationId,
        applicationName: schemaPg.applications.name,
        workflowName: schemaPg.pipelineRuns.workflowName,
        status: schemaPg.pipelineRuns.status,
        conclusion: schemaPg.pipelineRuns.conclusion,
        branch: schemaPg.pipelineRuns.branch,
        event: schemaPg.pipelineRuns.event,
        triggeredBy: schemaPg.pipelineRuns.triggeredBy,
        startedAt: schemaPg.pipelineRuns.startedAt,
        finishedAt: schemaPg.pipelineRuns.finishedAt,
        duration: schemaPg.pipelineRuns.duration,
        url: schemaPg.pipelineRuns.url,
      })
      .from(schemaPg.pipelineRuns)
      .leftJoin(
        schemaPg.applications,
        eq(schemaPg.pipelineRuns.applicationId, schemaPg.applications.id)
      )
      .where(
        or(
          eq(schemaPg.pipelineRuns.status, "running"),
          eq(schemaPg.pipelineRuns.status, "pending")
        )
      )
      .orderBy(desc(schemaPg.pipelineRuns.startedAt))
      .limit(10);

    // Fetch recent pipelines (last 10, any status)
    const recentPipelines = await db
      .select({
        id: schemaPg.pipelineRuns.id,
        applicationId: schemaPg.pipelineRuns.applicationId,
        applicationName: schemaPg.applications.name,
        workflowName: schemaPg.pipelineRuns.workflowName,
        status: schemaPg.pipelineRuns.status,
        conclusion: schemaPg.pipelineRuns.conclusion,
        branch: schemaPg.pipelineRuns.branch,
        event: schemaPg.pipelineRuns.event,
        triggeredBy: schemaPg.pipelineRuns.triggeredBy,
        startedAt: schemaPg.pipelineRuns.startedAt,
        finishedAt: schemaPg.pipelineRuns.finishedAt,
        duration: schemaPg.pipelineRuns.duration,
        url: schemaPg.pipelineRuns.url,
      })
      .from(schemaPg.pipelineRuns)
      .leftJoin(
        schemaPg.applications,
        eq(schemaPg.pipelineRuns.applicationId, schemaPg.applications.id)
      )
      .orderBy(desc(schemaPg.pipelineRuns.createdAt))
      .limit(10);

    // Fetch recent deployments (last 10)
    const recentDeployments = await db
      .select({
        id: schemaPg.deployments.id,
        applicationId: schemaPg.deployments.applicationId,
        applicationName: schemaPg.applications.name,
        environment: schemaPg.deployments.environment,
        status: schemaPg.deployments.status,
        imageTag: schemaPg.deployments.imageTag,
        deployedBy: schemaPg.deployments.deployedBy,
        createdAt: schemaPg.deployments.createdAt,
        namespace: schemaPg.deployments.namespace,
      })
      .from(schemaPg.deployments)
      .leftJoin(
        schemaPg.applications,
        eq(schemaPg.deployments.applicationId, schemaPg.applications.id)
      )
      .orderBy(desc(schemaPg.deployments.createdAt))
      .limit(10);

    // Get stats for today
    const todayStats = await db
      .select({
        totalBuilds: sql<number>`count(*)::int`,
        successCount: sql<number>`count(*) filter (where ${schemaPg.pipelineRuns.status} = 'success')::int`,
        avgDuration: sql<number>`coalesce(avg(${schemaPg.pipelineRuns.duration}), 0)::int`,
      })
      .from(schemaPg.pipelineRuns)
      .where(gte(schemaPg.pipelineRuns.createdAt, startOfToday));

    const deploymentStats = await db
      .select({
        totalDeployments: sql<number>`count(*)::int`,
        stagingCount: sql<number>`count(*) filter (where ${schemaPg.deployments.environment} = 'staging')::int`,
        productionCount: sql<number>`count(*) filter (where ${schemaPg.deployments.environment} = 'production')::int`,
      })
      .from(schemaPg.deployments)
      .where(gte(schemaPg.deployments.createdAt, startOfToday));

    const buildStats = todayStats[0] || { totalBuilds: 0, successCount: 0, avgDuration: 0 };
    const deplStats = deploymentStats[0] || { totalDeployments: 0, stagingCount: 0, productionCount: 0 };

    // Calculate success rate
    const successRate = buildStats.totalBuilds > 0
      ? (buildStats.successCount / buildStats.totalBuilds) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        activePipelines: (activePipelines as PipelineQueryResult[]).map((p) => ({
          ...p,
          startedAt: p.startedAt?.toISOString() || new Date().toISOString(),
          finishedAt: p.finishedAt?.toISOString() || null,
        })),
        recentPipelines: (recentPipelines as PipelineQueryResult[]).map((p) => ({
          ...p,
          startedAt: p.startedAt?.toISOString() || new Date().toISOString(),
          finishedAt: p.finishedAt?.toISOString() || null,
        })),
        recentDeployments: (recentDeployments as DeploymentQueryResult[]).map((d) => ({
          ...d,
          createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
        })),
        stats: {
          totalBuildsToday: buildStats.totalBuilds,
          successRate: Math.round(successRate * 10) / 10,
          avgBuildTime: buildStats.avgDuration,
          deploymentsToday: deplStats.totalDeployments,
          stagingDeployments: deplStats.stagingCount,
          productionDeployments: deplStats.productionCount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch pipeline metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pipeline metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

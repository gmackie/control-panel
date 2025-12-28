import { NextRequest, NextResponse } from "next/server";
import { getPostgresDb, schemaPg } from "@/lib/db/postgres";
import { eq, desc, and } from "drizzle-orm";

/**
 * Environment status with deployed commit info
 */
interface EnvironmentInfo {
  environment: string;
  status: string;
  currentCommitSha: string | null;
  currentCommitMessage: string | null;
  currentImageTag: string | null;
  replicas: number;
  readyReplicas: number;
  lastDeployedAt: string | null;
  lastDeployedBy: string | null;
  url: string | null;
}

/**
 * Quick metrics for the app
 */
interface QuickMetrics {
  totalCommits: number;
  totalDeployments: number;
  totalPipelines: number;
  successRate: number;
  lastActivityAt: string | null;
}

/**
 * Environment status from database
 */
interface EnvStatusResult {
  environment: string;
  status: string;
  currentCommitSha: string | null;
  currentImageTag: string | null;
  replicas: number | null;
  readyReplicas: number | null;
  lastDeployedAt: Date | null;
  lastDeployedBy: string | null;
  url: string | null;
}

/**
 * GET /api/apps/[id]/dashboard
 * 
 * Returns dashboard data for an application including:
 * - App details and status
 * - Environment statuses (staging/production) with deployed commits
 * - Quick metrics
 * - External links
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  
  try {
    const db = await getPostgresDb();
    
    if (!db) {
      return NextResponse.json({
        success: false,
        error: "Database not configured",
      }, { status: 500 });
    }

    const appId = decodeURIComponent(params.id);
    
    // Get application by ID or slug
    const apps = await db
      .select()
      .from(schemaPg.applications)
      .where(eq(schemaPg.applications.id, appId))
      .limit(1);
    
    // If not found by ID, try by slug
    let app = apps[0];
    if (!app) {
      const appsBySlug = await db
        .select()
        .from(schemaPg.applications)
        .where(eq(schemaPg.applications.slug, appId))
        .limit(1);
      app = appsBySlug[0];
    }
    
    if (!app) {
      return NextResponse.json({
        success: false,
        error: "Application not found",
      }, { status: 404 });
    }

    // Get environment statuses with commit info
    const envStatuses = await db
      .select({
        environment: schemaPg.environmentStatus.environment,
        status: schemaPg.environmentStatus.status,
        currentCommitSha: schemaPg.environmentStatus.currentCommitSha,
        currentImageTag: schemaPg.environmentStatus.currentImageTag,
        replicas: schemaPg.environmentStatus.replicas,
        readyReplicas: schemaPg.environmentStatus.readyReplicas,
        lastDeployedAt: schemaPg.environmentStatus.lastDeployedAt,
        lastDeployedBy: schemaPg.environmentStatus.lastDeployedBy,
        url: schemaPg.environmentStatus.url,
      })
      .from(schemaPg.environmentStatus)
      .where(eq(schemaPg.environmentStatus.applicationId, app.id));

    // Get commit messages for deployed commits
    const typedEnvStatuses = envStatuses as EnvStatusResult[];
    const commitShas = typedEnvStatuses
      .map(e => e.currentCommitSha)
      .filter((sha): sha is string => sha !== null);
    
    const commitMessages: Record<string, string> = {};
    if (commitShas.length > 0) {
      for (const sha of commitShas) {
        const commits = await db
          .select({ sha: schemaPg.commits.sha, message: schemaPg.commits.message })
          .from(schemaPg.commits)
          .where(eq(schemaPg.commits.sha, sha))
          .limit(1);
        if (commits[0]) {
          commitMessages[sha] = commits[0].message;
        }
      }
    }

    // Build environment info with commit messages
    const environments: EnvironmentInfo[] = typedEnvStatuses.map(env => ({
      environment: env.environment,
      status: env.status,
      currentCommitSha: env.currentCommitSha,
      currentCommitMessage: env.currentCommitSha ? commitMessages[env.currentCommitSha] || null : null,
      currentImageTag: env.currentImageTag,
      replicas: env.replicas || 0,
      readyReplicas: env.readyReplicas || 0,
      lastDeployedAt: env.lastDeployedAt?.toISOString() || null,
      lastDeployedBy: env.lastDeployedBy,
      url: env.url,
    }));

    // If no environment statuses exist, create placeholder entries
    if (environments.length === 0) {
      // Get latest deployments to infer environment status
      const latestDeployments = await db
        .select()
        .from(schemaPg.deployments)
        .where(eq(schemaPg.deployments.applicationId, app.id))
        .orderBy(desc(schemaPg.deployments.createdAt))
        .limit(10);
      
      const envMap: Record<string, typeof latestDeployments[0]> = {};
      for (const dep of latestDeployments) {
        if (!envMap[dep.environment]) {
          envMap[dep.environment] = dep;
        }
      }
      
      for (const [envName, dep] of Object.entries(envMap)) {
        // Get commit message for this deployment
        let commitMessage: string | null = null;
        if (dep.commitId) {
          const commits = await db
            .select({ message: schemaPg.commits.message })
            .from(schemaPg.commits)
            .where(eq(schemaPg.commits.id, dep.commitId))
            .limit(1);
          commitMessage = commits[0]?.message || null;
        }
        
        environments.push({
          environment: envName,
          status: dep.status === 'deployed' ? 'healthy' : dep.status,
          currentCommitSha: null, // Would need to be tracked
          currentCommitMessage: commitMessage,
          currentImageTag: dep.imageTag,
          replicas: dep.replicas || 1,
          readyReplicas: dep.readyReplicas || 0,
          lastDeployedAt: dep.deployedAt?.toISOString() || dep.createdAt?.toISOString() || null,
          lastDeployedBy: dep.deployedBy,
          url: null,
        });
      }
    }

    // Ensure we always have staging and production entries
    const hasStaging = environments.some(e => e.environment === 'staging');
    const hasProduction = environments.some(e => e.environment === 'production');
    
    if (!hasStaging) {
      environments.push({
        environment: 'staging',
        status: 'not_deployed',
        currentCommitSha: null,
        currentCommitMessage: null,
        currentImageTag: null,
        replicas: 0,
        readyReplicas: 0,
        lastDeployedAt: null,
        lastDeployedBy: null,
        url: null,
      });
    }
    
    if (!hasProduction) {
      environments.push({
        environment: 'production',
        status: 'not_deployed',
        currentCommitSha: null,
        currentCommitMessage: null,
        currentImageTag: null,
        replicas: 0,
        readyReplicas: 0,
        lastDeployedAt: null,
        lastDeployedBy: null,
        url: null,
      });
    }

    // Get quick metrics
    const [commitCount] = await db
      .select({ count: schemaPg.commits.id })
      .from(schemaPg.commits)
      .where(eq(schemaPg.commits.applicationId, app.id));
    
    const [deploymentCount] = await db
      .select({ count: schemaPg.deployments.id })
      .from(schemaPg.deployments)
      .where(eq(schemaPg.deployments.applicationId, app.id));
    
    const pipelineStats = await db
      .select({
        total: schemaPg.pipelineRuns.id,
        status: schemaPg.pipelineRuns.status,
      })
      .from(schemaPg.pipelineRuns)
      .where(eq(schemaPg.pipelineRuns.applicationId, app.id)) as { total: string; status: string }[];
    
    const totalPipelines = pipelineStats.length;
    const successfulPipelines = pipelineStats.filter((p: { status: string }) => p.status === 'success').length;
    const successRate = totalPipelines > 0 
      ? Math.round((successfulPipelines / totalPipelines) * 100) 
      : 0;

    // Get last activity
    const lastCommit = await db
      .select({ committedAt: schemaPg.commits.committedAt })
      .from(schemaPg.commits)
      .where(eq(schemaPg.commits.applicationId, app.id))
      .orderBy(desc(schemaPg.commits.committedAt))
      .limit(1);

    const metrics: QuickMetrics = {
      totalCommits: commitCount ? 1 : 0, // Count aggregation would be better
      totalDeployments: deploymentCount ? 1 : 0,
      totalPipelines,
      successRate,
      lastActivityAt: lastCommit[0]?.committedAt?.toISOString() || null,
    };

    // Build external links
    const giteaBaseUrl = process.env.GITEA_URL || 'https://gitea.gmac.io';
    const harborBaseUrl = process.env.HARBOR_URL || 'https://registry.gmac.io';
    const grafanaBaseUrl = process.env.GRAFANA_URL || 'https://grafana.gmac.io';
    
    const repoName = app.repositoryFullName || app.slug;
    
    const externalLinks = {
      gitea: app.repositoryUrl || `${giteaBaseUrl}/${repoName}`,
      harbor: `${harborBaseUrl}/harbor/projects/library/repositories/${app.slug}`,
      grafana: `${grafanaBaseUrl}/d/app-dashboard/application-dashboard?var-app=${app.slug}`,
    };

    // Generate screenshot URL (placeholder - would need a screenshot service)
    const screenshotUrl = environments.find(e => e.environment === 'production')?.url
      ? `https://api.microlink.io/?url=${encodeURIComponent(environments.find(e => e.environment === 'production')!.url!)}&screenshot=true&meta=false&embed=screenshot.url`
      : null;

    return NextResponse.json({
      success: true,
      data: {
        app: {
          id: app.id,
          name: app.name,
          slug: app.slug,
          description: app.description,
          repositoryUrl: app.repositoryUrl,
          repositoryFullName: app.repositoryFullName,
          defaultBranch: app.defaultBranch,
          language: app.language,
          framework: app.framework,
          status: app.status,
          createdAt: app.createdAt?.toISOString(),
          updatedAt: app.updatedAt?.toISOString(),
        },
        environments,
        metrics,
        externalLinks,
        screenshotUrl,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch app dashboard:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch app dashboard",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

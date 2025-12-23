import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";
import { commitsRepo, applicationsRepo } from "@/lib/db/repositories";
import { isPostgresConfigured } from "@/lib/db/postgres";

interface ActivityItem {
  id: string;
  type: "commit" | "deployment" | "pipeline" | "release" | "alert" | "pr";
  action: string;
  message: string;
  actor?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  status?: "success" | "failure" | "pending" | "running";
}

/**
 * GET /api/apps/[id]/activity
 * 
 * Returns activity log for an application (commits, deployments, PRs, etc.)
 * Combines data from Gitea API and PostgreSQL activity_log table
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    
    // Get activity from Gitea
    const giteaActivity = await unifiedAppService.getActivityLog(appId, limit);
    
    // Transform to ActivityItem format
    const activities: ActivityItem[] = giteaActivity.map((item: any) => ({
      id: item.id,
      type: item.type.includes("pipeline") ? "pipeline" : 
            item.type.includes("pr") ? "pr" : 
            item.type as ActivityItem["type"],
      action: item.action.split(":")[0] || item.type,
      message: item.action,
      actor: item.actor?.name || item.actor?.id,
      timestamp: item.timestamp,
      status: item.type.includes("completed") 
        ? (item.action.includes("success") ? "success" : 
           item.action.includes("failure") ? "failure" : undefined)
        : item.type.includes("started") ? "running" : undefined,
      metadata: {
        sha: item.commitSha,
        ...item.details,
      },
    }));
    
    // Also get activity from PostgreSQL if configured
    if (isPostgresConfigured()) {
      try {
        // Find the app by repository name or slug
        const dbApp = await applicationsRepo.getByRepository(appId) ||
                      await applicationsRepo.getBySlug(appId.includes('/') ? appId.split('/')[1] : appId);
        
        if (dbApp) {
          // Get activity log entries from PostgreSQL
          const dbActivity = await commitsRepo.getActivityLog(dbApp.id, { limit });
          
          // Add PostgreSQL activity entries
          dbActivity.forEach((entry: any) => {
            activities.push({
              id: `db-${entry.id}`,
              type: entry.type as ActivityItem["type"],
              action: entry.action,
              message: entry.message,
              actor: entry.actor,
              timestamp: entry.createdAt?.toISOString() || new Date().toISOString(),
              status: entry.metadata?.status,
              metadata: entry.metadata,
            });
          });
        }
      } catch (err) {
        console.warn("Failed to get PostgreSQL activity:", err);
      }
    }
    
    // Sort by timestamp (newest first) and limit
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return NextResponse.json({
      success: true,
      data: activities.slice(0, limit),
      count: activities.length,
    });
  } catch (error) {
    console.error("Failed to fetch activity log:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch activity log",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

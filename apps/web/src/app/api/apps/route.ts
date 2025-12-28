import { NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps
 * 
 * Returns list of all applications with unified data from:
 * - Gitea (repository info, commits, workflows)
 * - K8s (deployments, pods)
 * - Harbor (container images)
 */
export async function GET() {
  try {
    const applications = await unifiedAppService.getApplications();
    
    return NextResponse.json({
      success: true,
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch applications",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/[id]
 * 
 * Returns full details for a single application including:
 * - Repository info (branches, commits, PRs)
 * - CI/CD pipeline status and history
 * - K8s deployments and pods
 * - Container images
 * - Integration status
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Decode the ID (could be "owner/repo" format)
    const appId = decodeURIComponent(params.id);
    
    const application = await unifiedAppService.getApplication(appId);
    
    if (!application) {
      return NextResponse.json(
        { 
          success: false,
          error: "Application not found",
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error("Failed to fetch application:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch application",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

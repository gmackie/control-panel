import { NextRequest, NextResponse } from "next/server";
import { unifiedAppService } from "@/lib/applications/unified-service";

/**
 * GET /api/apps/[id]/activity
 * 
 * Returns activity log for an application (commits, deployments, PRs, etc.)
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const appId = decodeURIComponent(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    
    const activity = await unifiedAppService.getActivityLog(appId, limit);
    
    return NextResponse.json({
      success: true,
      data: activity,
      count: activity.length,
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
